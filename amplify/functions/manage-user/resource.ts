import { defineFunction } from '@aws-amplify/backend';

/**
 * Admin-only Lambda to manage an existing Cognito user:
 *   - action 'resend': re-send the invite email (AdminCreateUser MessageAction RESEND)
 *   - action 'delete': permanently delete the user (AdminDeleteUser)
 *
 * USER_POOL_ID + IAM permissions are wired in amplify/backend.ts.
 */
export const manageUser = defineFunction({
  name: 'manage-user',
  entry: './handler.ts',
});
