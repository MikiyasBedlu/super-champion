import { one, run } from '@/lib/db';
import { badRequest, handle, json, notFound } from '@/lib/api';
import { audit, requireAdmin, requireOwner } from '../../_guard';

export const dynamic = 'force-dynamic';

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  requireOwner(admin);
  const id = Number((await ctx.params).id);
  if (id === admin.id) throw badRequest('You cannot remove your own account.');
  const target = await one<{ id: number; email: string; role: string }>('SELECT id, email, role FROM admins WHERE id = $1', [id]);
  if (!target) throw notFound('Team member not found.');
  if (target.role === 'owner') {
    const owners = await one<{ n: string }>(`SELECT COUNT(*) AS n FROM admins WHERE role = 'owner'`);
    if (Number(owners?.n ?? 0) <= 1) throw badRequest('Keep at least one owner.');
  }
  await run('DELETE FROM admins WHERE id = $1', [id]);
  await audit(admin.id, 'delete', 'admin', id, target.email);
  return json({ ok: true });
});
