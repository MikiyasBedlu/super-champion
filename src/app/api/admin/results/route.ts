import { all, one, tx } from '@/lib/db';
import { badRequest, handle, json, notFound, readJson } from '@/lib/api';
import { resultsSchema } from '@/lib/validation';
import { pointsFor, type CategoryRow } from '@/lib/domain';
import { audit, requireAdmin } from '../_guard';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const categoryId = Number(new URL(req.url).searchParams.get('category'));
  const category = await one<CategoryRow>('SELECT * FROM categories WHERE id = $1', [categoryId]);
  if (!category) throw notFound('Category not found.');
  const skaters = await all(
    `SELECT r.id AS registration_id, r.first_name, r.last_name, r.club, r.bib_number, r.status,
            res.position, res.time_ms, res.score, res.points, res.outcome
       FROM registrations r
       LEFT JOIN results res ON res.registration_id = r.id AND res.category_id = r.category_id
      WHERE r.category_id = $1 AND r.status IN ('approved','checked_in')
      ORDER BY res.position IS NULL, res.position, r.bib_number, r.last_name`,
    [categoryId],
  );
  return json({ category, skaters });
});

/* Saving replaces the whole category in one transaction, so a half-saved result
   can never appear on the public page. Points are computed here, not sent by the browser. */
export const PUT = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const v = resultsSchema.parse(await readJson(req));
  const category = await one<CategoryRow>('SELECT * FROM categories WHERE id = $1', [v.category_id]);
  if (!category) throw notFound('Category not found.');

  const positions = v.entries.filter((e) => e.outcome === 'finished').map((e) => e.position);
  if (positions.some((p) => p === null || p === undefined)) throw badRequest('Every finished skater needs a position.');
  if (new Set(positions).size !== positions.length) throw badRequest('Two skaters have the same position.');

  const allowed = new Set(
    (await all<{ id: number }>(`SELECT id FROM registrations WHERE category_id = $1 AND status IN ('approved','checked_in')`, [v.category_id]))
      .map((r) => r.id),
  );
  for (const e of v.entries) {
    if (!allowed.has(e.registration_id)) throw badRequest('A result belongs to a skater who is not approved in this category.');
  }

  await tx(async (t) => {
    await t.run('DELETE FROM results WHERE category_id = $1', [v.category_id]);
    for (const e of v.entries) {
      await t.run(
        `INSERT INTO results (event_id, category_id, registration_id, position, time_ms, score, points, outcome)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [category.event_id, v.category_id, e.registration_id, e.outcome === 'finished' ? e.position : null, e.time_ms, e.score,
          pointsFor(e.position ?? null, e.outcome), e.outcome],
      );
    }
  });

  await audit(admin.id, 'save_results', 'category', v.category_id, `${v.entries.length} entries`);
  return json({ saved: v.entries.length });
});
