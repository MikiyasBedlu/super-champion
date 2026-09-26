import { all, one } from '@/lib/db';
import { conflict, handle, json, readJson } from '@/lib/api';
import { teamSchema } from '@/lib/validation';
import { hashPassword } from '@/lib/auth';
import { audit, requireAdmin, requireOwner } from '../_guard';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  return json({ team: await all('SELECT id, email, name, role, last_login_at, created_at FROM admins ORDER BY id') });
});

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  requireOwner(admin);
  const v = teamSchema.parse(await readJson(req));
  if (await one('SELECT 1 FROM admins WHERE lower(email) = $1', [v.email])) throw conflict('That email already has an account.');
  const member = await one<{ id: number }>(
    'INSERT INTO admins (email, name, role, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, email, name, role, created_at',
    [v.email, v.name, v.role, await hashPassword(v.password)],
  );
  await audit(admin.id, 'create', 'admin', member!.id, v.email);
  return json({ member }, 201);
});
