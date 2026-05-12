import type { Schema } from '../../data/resource';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({});

export const handler: Schema['inviteUser']['functionHandler'] = async (event) => {
  const { email, fullName, role } = event.arguments as {
    email: string;
    fullName: string;
    role: 'admin' | 'staff';
  };

  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) {
    return { ok: false, error: 'USER_POOL_ID env var not set' };
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    await cognito.send(
      new AdminCreateUserCommand({
        UserPoolId: userPoolId,
        Username: cleanEmail,
        DesiredDeliveryMediums: ['EMAIL'],
        UserAttributes: [
          { Name: 'email', Value: cleanEmail },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'name', Value: fullName },
        ],
      }),
    );
  } catch (err: any) {
    if (err instanceof UsernameExistsException) {
      return { ok: false, error: 'A user with that email already exists.' };
    }
    return { ok: false, error: err?.message || String(err) };
  }

  // Put them in the requested Cognito group (staff or admin)
  try {
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: userPoolId,
        Username: cleanEmail,
        GroupName: role === 'admin' ? 'admin' : 'staff',
      }),
    );
  } catch (err: any) {
    return {
      ok: true,
      warning: 'User created but adding to group failed: ' + (err?.message || String(err)),
    };
  }

  return { ok: true, email: cleanEmail };
};
