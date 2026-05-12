import { defineFunction, secret } from '@aws-amplify/backend';

/**
 * Admin-only Lambda that invites a new user.
 *
 * Wired up in `amplify/backend.ts` to grant `cognito-idp:AdminCreateUser` and
 * `cognito-idp:AdminAddUserToGroup` permissions on the User Pool. Cognito
 * itself takes care of sending the welcome email (with a temp password)
 * using its built-in email config — no SES code path here.
 */
export const inviteUser = defineFunction({
  name: 'invite-user',
  entry: './handler.ts',
  environment: {
    // USER_POOL_ID is injected at deploy time in amplify/backend.ts
  },
});
