import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { inviteUser } from '../functions/invite-user/resource';
import { listAppUsers } from '../functions/list-app-users/resource';
import { manageUser } from '../functions/manage-user/resource';

/**
 * DynamoDB-backed schema exposed via AppSync GraphQL.
 *
 * Authorization model:
 *   - A Review is owned by the staff member who created it (allow.owner).
 *     They can create + read their own. They CANNOT update — only admin can
 *     flip a Review from pending to approved/rejected.
 *   - Members of the `admin` group can read / write / delete everything.
 *   - Caps and announcements are admin-controlled; everyone authenticated
 *     can read them.
 *   - Invite mutation is admin-only and runs the inviteUser Lambda, which
 *     calls AdminCreateUser in Cognito (sending the official welcome email).
 */
const schema = a
  .schema({
    Review: a
      .model({
        owner: a.string(),
        userName: a.string().required(),
        monthKey: a.string().required(), // e.g. "2025-05"
        platform: a.string().required(), // "Google" | "Trustpilot"
        status: a.enum(['pending', 'approved', 'rejected']),
        screenshotPath: a.string().required(), // Full S3 path including identity prefix
        reviewerName: a.string(),
        rating: a.integer(),
        adminComment: a.string(),
        submittedAt: a.datetime(),
        decidedAt: a.datetime(),
        decidedBy: a.string(),
      })
      .secondaryIndexes((index) => [index('monthKey').sortKeys(['status'])])
      .authorization((allow) => [
        allow.owner().to(['create', 'read', 'delete']),
        allow.group('admin').to(['create', 'read', 'update', 'delete']),
      ]),

    MonthlyCap: a
      .model({
        userEmail: a.string().required(),
        monthKey: a.string().required(),
        capValue: a.integer().required(),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.group('admin'),
      ]),

    Announcement: a
      .model({
        text: a.string().required(),
        active: a.boolean().required(),
      })
      .authorization((allow) => [
        allow.authenticated().to(['read']),
        allow.group('admin'),
      ]),

    /**
     * Admin invites a new user. Triggers a Lambda that calls
     * Cognito AdminCreateUser, which sends the welcome email with a
     * temporary password.
     */
    inviteUser: a
      .mutation()
      .arguments({
        email: a.string().required(),
        fullName: a.string().required(),
        role: a.enum(['admin', 'staff']),
      })
      .returns(a.json())
      .authorization((allow) => [allow.group('admin')])
      .handler(a.handler.function(inviteUser)),

    /** Admin: list all Cognito users with status + role. */
    listAppUsers: a
      .query()
      .returns(a.json())
      .authorization((allow) => [allow.group('admin')])
      .handler(a.handler.function(listAppUsers)),

    /** Admin: resend an invite ('resend') or delete a user ('delete'). */
    manageUser: a
      .mutation()
      .arguments({
        email: a.string().required(),
        action: a.string().required(),
      })
      .returns(a.json())
      .authorization((allow) => [allow.group('admin')])
      .handler(a.handler.function(manageUser)),
  })
  .authorization((allow) => [
    allow.resource(inviteUser),
    allow.resource(listAppUsers),
    allow.resource(manageUser),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
