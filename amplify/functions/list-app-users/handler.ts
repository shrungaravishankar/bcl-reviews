import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
  AdminListGroupsForUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const cognito = new CognitoIdentityProviderClient({});

type UserRow = {
  email: string;
  name: string;
  role: string;
  status: string;   // CONFIRMED | FORCE_CHANGE_PASSWORD | RESET_REQUIRED | ...
  enabled: boolean;
  createdAt: string;
};

// Authorization is enforced by AppSync (allow.group('admin')); this resolver
// only runs for admins.
export const handler = async () => {
  const userPoolId = process.env.USER_POOL_ID;
  if (!userPoolId) return { error: 'USER_POOL_ID missing', users: [] as UserRow[] };

  try {
    const listResp = await cognito.send(
      new ListUsersCommand({ UserPoolId: userPoolId, Limit: 60 })
    );

    const rows: UserRow[] = [];
    for (const u of listResp.Users || []) {
      const email =
        u.Attributes?.find((a) => a.Name === 'email')?.Value || u.Username || '';
      const name = u.Attributes?.find((a) => a.Name === 'name')?.Value || '';

      let role = 'none';
      try {
        const grps = await cognito.send(
          new AdminListGroupsForUserCommand({ UserPoolId: userPoolId, Username: u.Username! })
        );
        const groupNames = (grps.Groups || [])
          .map((g) => g.GroupName)
          .filter((g): g is string => !!g);
        if (groupNames.includes('admin')) role = 'admin';
        else if (groupNames.includes('staff')) role = 'staff';
      } catch (_) { /* ignore per-user group fetch errors */ }

      rows.push({
        email,
        name,
        role,
        status: u.UserStatus || 'UNKNOWN',
        enabled: u.Enabled !== false,
        createdAt: u.UserCreateDate ? u.UserCreateDate.toISOString() : '',
      });
    }

    // Pending invites (FORCE_CHANGE_PASSWORD) first, then alphabetical.
    rows.sort((a, b) => {
      const pa = a.status === 'FORCE_CHANGE_PASSWORD' ? 0 : 1;
      const pb = b.status === 'FORCE_CHANGE_PASSWORD' ? 0 : 1;
      if (pa !== pb) return pa - pb;
      return (a.name || a.email).localeCompare(b.name || b.email);
    });

    return { error: null, users: rows };
  } catch (err: any) {
    return { error: err?.message || 'Failed to list users.', users: [] as UserRow[] };
  }
};
