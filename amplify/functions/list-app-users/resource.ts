import { defineFunction } from '@aws-amplify/backend';

/**
 * Admin-only Lambda that lists Cognito users with their status + role.
 * USER_POOL_ID is injected at deploy time in amplify/backend.ts, and IAM
 * permissions (ListUsers, AdminListGroupsForUser) are granted there too.
 */
export const listAppUsers = defineFunction({
  name: 'list-app-users',
  entry: './handler.ts',
});
