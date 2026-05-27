import { defineFunction, secret } from '@aws-amplify/backend';

/**
 * Mints a Firebase custom token from the caller's Cognito session so the
 * browser can sign in to Firebase (signInWithCustomToken) and talk to
 * Firestore under owner-scoped security rules.
 *
 * Invoked via AppSync with the userPool authorizer, so the handler receives
 * the caller's Cognito `sub` and group membership in event.identity — no
 * manual JWT verification is needed. The Cognito group ('admin' | 'staff')
 * is written as a Firebase custom claim `role`, which firestore.rules reads.
 *
 * FIREBASE_SERVICE_ACCOUNT is the full service-account JSON for the
 * 'reviews-facbe' project, stored as an Amplify secret:
 *   npx ampx sandbox secret set FIREBASE_SERVICE_ACCOUNT < service-account.json
 */
export const exchangeToken = defineFunction({
  name: 'exchange-token',
  entry: './handler.ts',
  environment: {
    FIREBASE_SERVICE_ACCOUNT: secret('FIREBASE_SERVICE_ACCOUNT'),
  },
});
