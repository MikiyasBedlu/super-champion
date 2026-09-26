import { one, run } from '@/lib/db';
import { badRequest, handle, json, readJson } from '@/lib/api';
import { passwordSchema } from '@/lib/validation';
import { hashPassword, setSessionCookie, verifyPassword } from '@/lib/auth';
import { audit, requireAdmin } from '../_guard';

export const dynamic = 'force-dynamic';

/* Changing the password bumps session_version, which signs out every other device. */
export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const v = passwordSchema.parse(await readJson(req));
  const row = await one<{ password_hash: string }>('SELECT password_hash FROM admins WHERE id = $1', [admin.id]);
  if (!row || !(await verifyPassword(v.current_password, row.password_hash))) {
    throw badRequest('Some fields need attention.', { current_password: 'Current password is wrong.' });
  }
  await run('UPDATE admins SET password_hash = $1, session_version = session_version + 1 WHERE id = $2', [await hashPassword(v.new_password), admin.id]);
  const fresh = await one<{ id: number; session_version: number }>('SELECT id, session_version FROM admins WHERE id = $1', [admin.id]);
  if (fresh) await setSessionCookie(fresh);
  await audit(admin.id, 'password_change', 'admin', admin.id);
  return json({ ok: true });
});
