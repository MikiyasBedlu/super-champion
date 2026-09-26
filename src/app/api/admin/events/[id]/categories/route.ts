import { one } from '@/lib/db';
import { badRequest, handle, json, notFound, readJson } from '@/lib/api';
import { categorySchema } from '@/lib/validation';
import type { CategoryRow } from '@/lib/domain';
import { audit, requireAdmin } from '../../../_guard';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const eventId = Number((await ctx.params).id);
  if (!(await one('SELECT 1 FROM events WHERE id = $1', [eventId]))) throw notFound('Event not found.');
  const v = categorySchema.parse(await readJson(req));
  if (v.min_age > v.max_age) throw badRequest('Some fields need attention.', { max_age: 'The maximum age must be at least the minimum age.' });
  const category = await one<CategoryRow>(
    `INSERT INTO categories (event_id, name, discipline, gender, min_age, max_age, distance, fee_birr, capacity, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [eventId, v.name, v.discipline, v.gender, v.min_age, v.max_age, v.distance, v.fee_birr, v.capacity, v.sort_order],
  );
  await audit(admin.id, 'create', 'category', category!.id, v.name);
  return json({ category }, 201);
});
