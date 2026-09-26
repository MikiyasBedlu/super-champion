import { one, run } from '@/lib/db';
import { badRequest, conflict, handle, json, notFound, readJson } from '@/lib/api';
import { categorySchema } from '@/lib/validation';
import type { CategoryRow } from '@/lib/domain';
import { audit, requireAdmin } from '../../_guard';

export const dynamic = 'force-dynamic';

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const id = Number((await ctx.params).id);
  const cat = await one<CategoryRow>('SELECT * FROM categories WHERE id = $1', [id]);
  if (!cat) throw notFound('Category not found.');
  const v = categorySchema.partial().parse(await readJson(req));
  const m = { ...cat, ...v };
  if (m.min_age > m.max_age) throw badRequest('Some fields need attention.', { max_age: 'The maximum age must be at least the minimum age.' });
  const category = await one<CategoryRow>(
    `UPDATE categories SET name=$1, discipline=$2, gender=$3, min_age=$4, max_age=$5, distance=$6, fee_birr=$7, capacity=$8, sort_order=$9
      WHERE id=$10 RETURNING *`,
    [m.name, m.discipline, m.gender, m.min_age, m.max_age, m.distance, m.fee_birr, m.capacity, m.sort_order, id],
  );
  await audit(admin.id, 'update', 'category', id, Object.keys(v).join(','));
  return json({ category });
});

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const id = Number((await ctx.params).id);
  if (await one('SELECT 1 FROM registrations WHERE category_id = $1 LIMIT 1', [id])) {
    throw conflict('Skaters are registered in this category. Move them to another category first.');
  }
  if (!(await run('DELETE FROM categories WHERE id = $1', [id]))) throw notFound('Category not found.');
  await audit(admin.id, 'delete', 'category', id);
  return json({ ok: true });
});
