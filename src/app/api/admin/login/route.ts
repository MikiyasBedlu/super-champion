import { one, run } from '@/lib/db';
import { clientIp, handle, HttpError, json, rateLimit, readJson, resetLimit } from '@/lib/api';
import { loginSchema } from '@/lib/validation';
import { assertSameOrigin, burnPasswordCheck, setSessionCookie, verifyPassword } from '@/lib/auth';
import { audit } from '../_guard';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  rateLimit('login', clientIp(req));
  const v = loginSchema.parse(await readJson(req));
  // A second limit per account, so one email cannot be attacked from many addresses.
  rateLimit('login', `acct:${v.email}`);

  const admin = await one<{ id: number; email: string; name: string; role: 'owner' | 'staff'; session_version: number; password_hash: string }>(
    'SELECT id, email, name, role, session_version, password_hash FROM admins WHERE lower(email) = $1',
    [v.email],
  );
  const ok = admin ? await verifyPassword(v.password, admin.password_hash) : (await burnPasswordCheck(v.password), false);
  if (!ok || !admin) throw new HttpError(401, 'That email and password do not match.');

  resetLimit('login', `acct:${v.email}`);
  await run('UPDATE admins SET last_login_at = now() WHERE id = $1', [admin.id]);
  await audit(admin.id, 'login', 'admin', admin.id);
  await setSessionCookie(admin);
  return json({ admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
});
