import { one, tx } from '@/lib/db';
import { handle, json, notFound, readJson } from '@/lib/api';
import { audit, requireAdmin } from '../../../_guard';

export const dynamic = 'force-dynamic';

/* Gives every approved skater without a bib the next free number, in category order.
   Numbers already handed out are left alone. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const eventId = Number((await ctx.params).id);
  if (!(await one('SELECT 1 FROM events WHERE id = $1', [eventId]))) throw notFound('Event not found.');
  const body = await readJson(req);
  const startAt = Math.max(1, Math.min(99000, Number(body.start_at ?? 1) || 1));

  const assigned = await tx(async (t) => {
    const used = new Set(
      (await t.all<{ bib_number: number }>('SELECT bib_number FROM registrations WHERE event_id = $1 AND bib_number IS NOT NULL', [eventId]))
        .map((r) => r.bib_number),
    );
    const todo = await t.all<{ id: number }>(
      `SELECT r.id FROM registrations r JOIN categories c ON c.id = r.category_id
        WHERE r.event_id = $1 AND r.status IN ('approved','checked_in') AND r.bib_number IS NULL
        ORDER BY c.sort_order, c.min_age, r.last_name, r.first_name`,
      [eventId],
    );
    let next = startAt;
    for (const row of todo) {
      while (used.has(next)) next++;
      await t.run('UPDATE registrations SET bib_number = $1 WHERE id = $2', [next, row.id]);
      used.add(next);
    }
    return todo.length;
  });

  await audit(admin.id, 'assign_bibs', 'event', eventId, `${assigned} bibs`);
  return json({ assigned });
});
