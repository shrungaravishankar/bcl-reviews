import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  UserNotFoundException,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({});

type ManageEvent = {
  arguments: { email: string; action: string };
  identity?: { claims?: { email?: string }; username?: string };
};

// Authorization is enforced by AppSync (allow.group('admin')); this resolver
// only runs for admins.
export const handler = async (event: ManageEvent) => {
  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) return { ok: false, error: 'USER_POOL_ID not set' };

  const email = (event.arguments?.email || '').trim().toLowerCase();
  const action = event.arguments?.action;
  if (!email || !action) return { ok: false, error: 'email and action are required' };

  // Don't let an admin delete their own account.
  const callerEmail = String(event.identity?.claims?.email || event.identity?.username || '').toLowerCase();
  if (action === 'delete' && callerEmail && callerEmail === email) {
    return { ok: false, error: 'You cannot delete your own account.' };
  }

  try {
    if (action === 'resend') {
      await cognito.send(
        new AdminCreateUserCommand({
          UserPoolId: userPoolId,
          Username: email,
          MessageAction: 'RESEND',
          DesiredDeliveryMediums: ['EMAIL'],
        })
      );
      return { ok: true, message: `Invite re-sent to ${email}.` };
    }

    if (action === 'delete') {
      await cognito.send(
        new AdminDeleteUserCommand({ UserPoolId: userPoolId, Username: email })
      );
      return { ok: true, message: `${email} has been deleted.` };
    }

    return { ok: false, error: `Unknown action: ${action}` };
  } catch (err: any) {
    if (err instanceof UserNotFoundException) return { ok: false, error: 'User not found.' };
    // RESEND only works while a user is still pending; surface a clear message.
    if (action === 'resend' && /InvalidParameterException|already.*confirmed|CONFIRMED/i.test(err?.message || '')) {
      return { ok: false, error: 'Cannot resend — this user has already confirmed their account.' };
    }
    return { ok: false, error: err?.message || String(err) };
  }
};
