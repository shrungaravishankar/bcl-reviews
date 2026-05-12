import { defineAuth } from '@aws-amplify/backend';

/**
 * Cognito User Pool.
 *
 * - Login is via email + password.
 * - Two groups: `admin` and `staff`. Both must exist before users can sign up
 *   meaningfully — the very first user you create has to be added to `admin`
 *   from the AWS console (see README).
 * - When the admin invites someone via the app, the invite Lambda calls
 *   AdminCreateUser, which makes Cognito send the official welcome email with
 *   a temporary password. The user changes the temp password on first login.
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
  userAttributes: {
    fullname: { required: true, mutable: true },
  },
  groups: ['admin', 'staff'],
});
