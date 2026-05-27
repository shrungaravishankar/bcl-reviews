import { type ClientSchema, a, defineData } from '@aws-amplify/backend';
import { inviteUser } from '../functions/invite-user/resource';
import { exchangeToken } from '../functions/exchange-token/resource';

/**
 * AppSync GraphQL surface. Application data (reviews, announcements, caps)
 * now lives in Firestore — see firestore.rules. This schema only exposes the
 * two server-side actions that can't run in the browser:
 *
 *   - inviteUser: admin-only; calls Cognito AdminCreateUser (welcome email).
 *   - exchangeFirebaseToken: any authenticated Cognito user; mints a Firebase
 *     custom token (uid = Cognito sub, role claim from the Cognito group) so
 *     the browser can sign in to Firebase and read/write Firestore under
 *     owner-scoped rules.
 *
 * Authorization stays on Cognito userPool; Firebase identity is derived from
 * it, never the other way around.
 */
const schema = a
  .schema({
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

    exchangeFirebaseToken: a
      .query()
      .returns(a.json())
      .authorization((allow) => [allow.authenticated()])
      .handler(a.handler.function(exchangeToken)),
  })
  .authorization((allow) => [
    allow.resource(inviteUser),
    allow.resource(exchangeToken),
  ]);

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
