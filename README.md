# BCL Review Rewards — AWS Amplify build

Real backend, real cross-device sharing. The frontend is a tiny static HTML page; everything stateful lives in AWS — Cognito for auth, DynamoDB (via AppSync) for review data, S3 for screenshots. All inside your AWS account, your region, no third party.

## What's in this folder

| Path | Purpose |
| --- | --- |
| `index.html` | The page shell. Loads `app.js` and the Amplify SDK from a CDN. |
| `app.js` | All the runtime logic — auth, screenshot upload, admin queue. |
| `amplify/auth/resource.ts` | Cognito User Pool definition + `admin` and `staff` groups. |
| `amplify/data/resource.ts` | DynamoDB schema (Review, MonthlyCap, Announcement) + the `inviteUser` mutation. |
| `amplify/storage/resource.ts` | Private S3 bucket; per-user folder isolation. |
| `amplify/functions/invite-user/` | Lambda that calls Cognito `AdminCreateUser` so admin can invite by email. |
| `amplify/backend.ts` | Wires the Lambda's IAM permission to the User Pool. |
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

## SES sandbox mode

Brand-new AWS accounts have SES in **sandbox**: Cognito can only send emails to addresses you've explicitly verified. To send to anyone, request production access:

1. AWS Console → SES → **Request production access**
2. Fill out the form (use case: transactional emails for an employee tool)
3. Wait ~24 hours for approval

Until then, verify each invitee's email in SES → **Verified identities** so they can receive the welcome email.

## How the data flows

```
Staff phone → app.js → uploadData() → S3 bucket /reviews/<userId>/<month>/<uuid>.jpg
                    → client.models.Review.create({status:'pending', screenshotPath, ...})
                       → DynamoDB row visible to admin
Admin laptop → app.js → client.models.Review.list({filter:{status:{eq:'pending'}}})
                     → fetches all pending rows across all staff (admin group has read-all)
                     → renders signed S3 URLs for the screenshots
                     → click Approve → client.models.Review.update({status:'approved'})
                       → staff's history view updates next time they load
```

Authorization is enforced by AppSync + Cognito groups. Staff users can only `create` and `read` their own Review rows. The `admin` group can read/update/delete any row.

## Local development

You can run a sandbox backend on your laptop without touching production:

```bash
npm install
npx ampx sandbox             # provisions a personal Cognito + DynamoDB + S3 in your account
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
- DynamoDB is encrypted at rest by default.
- S3 bucket is private; no public read; objects only accessible via short-lived presigned URLs handed out by Amplify Storage.
- Screenshot S3 objects live under `reviews/<cognitoIdentityId>/...`; IAM policies prevent users from reading each other's folders. Admin role bypasses that.
- The Lambda for invites has the minimum IAM permissions: only `AdminCreateUser` + `AdminAddUserToGroup` on this one User Pool, nothing else.
- All traffic is HTTPS-only (Amplify Hosting enforces SSL).
- Data does not leave your AWS region.

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
