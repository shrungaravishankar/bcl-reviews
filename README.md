# BCL Review Rewards — AWS Amplify + Firebase build

Real backend, real cross-device sharing. The frontend is a tiny static HTML page. Auth stays on **AWS Cognito**; review/announcement data now lives in **Google Firestore**; screenshots stay in **AWS S3**. A small token-exchange Lambda bridges the two clouds so Firestore can enforce per-user security under the same Cognito identity.

## What's in this folder

| Path | Purpose |
| --- | --- |
| `index.html` | The page shell. Loads `app.js`, the Amplify SDK, and the Firebase SDK via an importmap. |
| `app.js` | All the runtime logic — auth, Cognito→Firebase bridge, screenshot upload, admin queue. |
| `firebase.js` | Firebase app init; exports `firebaseAuth`, `db` (Firestore), `analytics`. |
| `firestore.rules` | Firestore security rules — owner-scoped reviews, admin-only approvals. |
| `firestore.indexes.json` | Composite index (`status` + `monthKey`) for the admin queue queries. |
| `firebase.json` | Tells `firebase deploy` where the rules + indexes live. |
| `amplify/auth/resource.ts` | Cognito User Pool definition + `admin` and `staff` groups. |
| `amplify/data/resource.ts` | AppSync surface — `inviteUser` + `exchangeFirebaseToken` mutations only (data moved to Firestore). |
| `amplify/storage/resource.ts` | Private S3 bucket; per-user folder isolation. |
| `amplify/functions/invite-user/` | Lambda that calls Cognito `AdminCreateUser` so admin can invite by email. |
| `amplify/functions/exchange-token/` | Lambda that mints a Firebase custom token from the Cognito session (role claim from group). |
| `amplify/backend.ts` | Wires the Lambdas' IAM permissions + the Firebase service-account secret. |
| `package.json`, `tsconfig.json` | Required for `ampx pipeline-deploy`. |
| `amplify.yml` | Amplify Hosting build spec: provision backend, then publish frontend. |
| `manifest.webmanifest`, `icon.svg`, `404.html`, `robots.txt` | Static extras. |

## One-time AWS setup

### 1. Push this folder to your linked repo

Drop everything in this folder into your Amplify-Hosting-connected Git repo (root of the repo). Commit and push. The next Amplify Hosting build will:
1. Run `npm ci`
2. Run `npx ampx pipeline-deploy` — which provisions Cognito, DynamoDB, S3, Lambda, IAM roles automatically using the definitions in `amplify/`
3. Generate `amplify_outputs.json` alongside `index.html`
4. Publish the site

The first deploy takes 5–10 minutes because it's creating CloudFormation stacks. Subsequent deploys are 1–2 minutes.

### 2. Create the first admin

Cognito starts with no users. The first admin has to be created manually in the AWS Console:

1. AWS Console → Cognito → User Pools → pick the one Amplify created (named like `amplify_…_userPool…`).
2. Users tab → **Create user**:
   - Send an email invitation: yes
   - Email address: your admin email
   - Set a temporary password
3. After creating, click the user → **Add user to group** → `admin`.
4. Go to the deployed site, sign in with that email + the temporary password. Cognito will force you to set a real password. You're in.

### 3. Invite the rest of the team from inside the app

Admin → Users tab → enter name + email + role → Send invite. AWS Cognito sends them a real welcome email with a temp password (you don't need EmailJS for this — Cognito uses SES under the hood; in sandbox mode it can only mail verified addresses, see below).

## One-time Firebase setup

Data lives in Firestore (`reviews-facbe` project). Three things must be in place:

### 1. Service-account key for the token-exchange Lambda

The `exchange-token` Lambda needs Firebase Admin credentials to mint custom tokens.

1. Firebase console → Project settings → **Service accounts** → **Generate new private key** → downloads a JSON file.
2. Store the full JSON as an Amplify secret (the value the Lambda reads from `FIREBASE_SERVICE_ACCOUNT`):
   ```bash
   # Local sandbox:
   npx ampx sandbox secret set FIREBASE_SERVICE_ACCOUNT < service-account.json
   # Pipeline/branch deploy:
   npx ampx pipeline-deploy --secret FIREBASE_SERVICE_ACCOUNT="$(cat service-account.json)"
   ```
   Never commit the JSON — it's a full admin credential for the Firebase project.

### 2. Deploy Firestore rules + indexes

```bash
npm install -g firebase-tools   # if you don't have it
firebase login
firebase deploy --only firestore:rules,firestore:indexes --project reviews-facbe
```

`firebase.json` points at `firestore.rules` and `firestore.indexes.json`. The composite index can take a few minutes to build before the admin Approved/Rejected tabs return results.

### 3. (Production) lock the Firebase API key

The `apiKey` in `firebase.js` is public by design — security is enforced entirely by `firestore.rules`, which require a valid Firebase identity (minted only from a real Cognito session). Optionally restrict the key in Google Cloud console → Credentials → API key → HTTP referrer restrictions to your hosting domain.

## SES sandbox mode

Brand-new AWS accounts have SES in **sandbox**: Cognito can only send emails to addresses you've explicitly verified. To send to anyone, request production access:

1. AWS Console → SES → **Request production access**
2. Fill out the form (use case: transactional emails for an employee tool)
3. Wait ~24 hours for approval

Until then, verify each invitee's email in SES → **Verified identities** so they can receive the welcome email.

## How the data flows

```
Sign-in:    Cognito signIn() → exchangeFirebaseToken (Lambda) → signInWithCustomToken()
            uid = Cognito sub, custom claim role = 'admin' | 'staff'

Staff phone → app.js → uploadData() → S3 bucket /reviews/<userId>/<month>/<uuid>.jpg
                    → addDoc(reviews, {owner: uid, status:'pending', screenshotPath, ...})
                       → Firestore doc visible to admin
Admin laptop → app.js → getDocs(query(reviews, where('status','==','pending')))
                     → fetches all pending docs across all staff (admin claim bypasses owner check)
                     → renders signed S3 URLs for the screenshots
                     → click Approve → updateDoc(reviews/<id>, {status:'approved'})
                       → staff's history view updates next time they load
```

Authorization has two layers that share one identity:
- **Cognito** owns sign-in, the `admin`/`staff` groups, and S3 access.
- **Firestore rules** enforce data access using the Firebase identity minted from that Cognito session: staff can only read/create/withdraw their own `pending` rows; the `admin` role can read/update/delete anything. See `firestore.rules`.

## Local development

You can run a sandbox backend on your laptop without touching production:

```bash
npm install
npx ampx sandbox secret set FIREBASE_SERVICE_ACCOUNT < service-account.json   # once
npx ampx sandbox             # provisions a personal Cognito + S3 + the two Lambdas
firebase deploy --only firestore:rules,firestore:indexes --project reviews-facbe
```

This writes a local `amplify_outputs.json`. Serve the frontend:

```bash
python3 -m http.server 8080
```

Open http://localhost:8080. When you're done: `npx ampx sandbox delete`.

## Cost (rough, for a ~10-person team)

Everything used here is in the AWS Free Tier indefinitely at your scale:
- **Cognito** — 50,000 MAUs free forever; you'll use maybe 10
- **AppSync** — 250k queries/month free; you'll use a few thousand
- **DynamoDB** — 25 GB storage + 25 RCU/25 WCU free; you'll use under 1 GB
- **S3** — 5 GB storage free for 12 months, then ~$0.023/GB/month
- **Lambda** — 1M invocations/month free
- **Amplify Hosting** — 1000 build minutes + 15 GB served/month free

Expected monthly cost after free tier: **under $1**.

## Security notes (for the "confidentiality" requirement)

- Cognito user passwords are hashed by AWS (you never see them).
- Firestore is encrypted at rest by Google; access is gated by `firestore.rules`, which require a Firebase identity that can only be minted from a valid Cognito session (via the `exchange-token` Lambda). The public `apiKey` alone grants nothing.
- S3 bucket is private; no public read; objects only accessible via short-lived presigned URLs handed out by Amplify Storage.
- Screenshot S3 objects live under `reviews/<cognitoIdentityId>/...`; IAM policies prevent users from reading each other's folders. Admin role bypasses that.
- The invite Lambda has minimum IAM: only `AdminCreateUser` + `AdminAddUserToGroup` on this one User Pool. The token-exchange Lambda holds the Firebase service-account key as an encrypted Amplify secret and talks only to Firebase.
- All traffic is HTTPS-only (Amplify Hosting enforces SSL).

## What's NOT in this build (yet)

The following tabs from the older localStorage build aren't in this rewrite — tell me which ones you want next and I'll add them in the same pattern:

- Leaderboard (cross-staff comparison)
- Payout export (CSV + print)
- Google verify (cross-check against the public Business profile)
- Monthly history navigation (currently always shows current month)
- Announcement banner display on staff dashboard
- Team monthly goal
- Review cap overrides
- Duplicate reviewer detector

Each is a query against existing data plus a render — straightforward additions once the core is deployed and working.

## When something breaks

| Symptom | First thing to check |
| --- | --- |
| Build fails in Amplify Console with "command not found: ampx" | `package.json` is at repo root, `npm ci` ran successfully |
| Page loads, then says "amplify_outputs.json not found" | The backend build didn't run. Check the Amplify Hosting build logs for `pipeline-deploy` errors |
| New user never gets the welcome email | SES is in sandbox mode — see "SES sandbox mode" above |
| Admin sees "Your account exists but no admin has assigned a role yet" | Add the user to the `admin` or `staff` group in the Cognito Console |
| "NotAuthorizedException" on operations | The signed-in user isn't in any Cognito group, or the group lacks the IAM action |
| "Could not connect to the data backend" after sign-in | `exchange-token` Lambda failed — check the `FIREBASE_SERVICE_ACCOUNT` secret is set and the JSON is valid |
| Firestore reads return "Missing or insufficient permissions" | Rules not deployed, or the role claim is missing — re-run `firebase deploy` and confirm the user's Cognito group |
| Admin Approved/Rejected tabs stay empty but Pending works | The composite index is still building (or not deployed) — check Firestore console → Indexes |
