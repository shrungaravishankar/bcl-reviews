import type { Schema } from '../../data/resource';
import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let app: App | undefined;
function adminApp(): App {
  if (app) return app;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT secret not set');
  const serviceAccount = JSON.parse(raw);
  app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(serviceAccount) });
  return app;
}

export const handler: Schema['exchangeFirebaseToken']['functionHandler'] = async (event) => {
  const identity = event.identity as
    | { sub?: string; claims?: Record<string, unknown> }
    | undefined;

  const sub = identity?.sub || (identity?.claims?.sub as string | undefined);
  if (!sub) {
    return { ok: false, error: 'No authenticated Cognito identity on request.' };
  }

  const groupsClaim = (identity?.claims?.['cognito:groups'] as string[] | string | undefined) ?? [];
  const groups = Array.isArray(groupsClaim) ? groupsClaim : [groupsClaim];
  const role = groups.includes('admin') ? 'admin' : 'staff';

  try {
    const token = await getAuth(adminApp()).createCustomToken(sub, { role });
    return { ok: true, token };
  } catch (err: any) {
    return { ok: false, error: err?.message || String(err) };
  }
};
