import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { inviteUser } from './functions/invite-user/resource';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';

const backend = defineBackend({
  auth,
  data,
  storage,
  inviteUser,
});

/**
 * Wire the invite-user Lambda so it can:
 *   - Call AdminCreateUser on our User Pool
 *   - Call AdminAddUserToGroup on our User Pool
 * Pass the User Pool ID in via an env var so the handler doesn't need to
 * discover it at runtime.
 */
const inviteFn = backend.inviteUser.resources.lambda;
const userPool = backend.auth.resources.userPool;

inviteFn.addToRolePolicy(
  new PolicyStatement({
    actions: ['cognito-idp:AdminCreateUser', 'cognito-idp:AdminAddUserToGroup'],
    resources: [userPool.userPoolArn],
  }),
);

inviteFn.addEnvironment('USER_POOL_ID', userPool.userPoolId);
