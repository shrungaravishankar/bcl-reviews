import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { inviteUser } from './functions/invite-user/resource';
import { listAppUsers } from './functions/list-app-users/resource';
import { manageUser } from './functions/manage-user/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  storage,
  inviteUser,
  listAppUsers,
  manageUser,
});

/**
 * Wire the invite-user Lambda so it can:
 *   - Call AdminCreateUser on our User Pool
 *   - Call AdminAddUserToGroup on our User Pool
 * Pass the User Pool ID in via an env var so the handler doesn't need to
 * discover it at runtime.
 */
const userPool = backend.auth.resources.userPool;

backend.inviteUser.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminAddUserToGroup'],
    resources: [userPool.userPoolArn],
  }),
);
backend.inviteUser.addEnvironment('USER_POOL_ID', userPool.userPoolId);

// ---- list-app-users: read users + their group memberships ----
backend.listAppUsers.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cognito-idp:ListUsers', 'cognito-idp:AdminListGroupsForUser'],
    resources: [userPool.userPoolArn],
  }),
);
backend.listAppUsers.addEnvironment('USER_POOL_ID', userPool.userPoolId);

// ---- manage-user: resend invite (AdminCreateUser) + delete user ----
backend.manageUser.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminDeleteUser'],
    resources: [userPool.userPoolArn],
  }),
);
backend.manageUser.addEnvironment('USER_POOL_ID', userPool.userPoolId);
