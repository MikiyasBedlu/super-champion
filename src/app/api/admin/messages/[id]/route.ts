import { run } from '@/lib/db';
import { handle, json, notFound, readJson } from '@/lib/api';
import { audit, requireAdmin } from '../../_guard';

export const dynamic = 'force-dynamic';

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireAdmin(req);
  const id = Number((await ctx.params).id);
  const body = await readJson(req);
  if (!(await run('UPDATE messages SET is_read = $1 WHERE id = $2', [Boolean(body.is_read), id]))) throw notFound('Message not found.');
  return json({ ok: true });
});

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const id = Number((await ctx.params).id);
  if (!(await run('DELETE FROM messages WHERE id = $1', [id]))) throw notFound('Message not found.');
  await audit(admin.id, 'delete', 'message', id);
  return json({ ok: true });
});
