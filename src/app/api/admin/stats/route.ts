import { all, one } from '@/lib/db';
import { handle, json } from '@/lib/api';
import { ACTIVE } from '@/lib/domain';
import { requireAdmin } from '../_guard';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const byStatus = await all<{ status: string; n: string }>('SELECT status, COUNT(*) AS n FROM registrations GROUP BY status');
  const registrations = Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)]));
  const unread = await one<{ n: string }>('SELECT COUNT(*) AS n FROM messages WHERE NOT is_read');
  const events = await all<{ id: number; slug: string; name: string; status: string; starts_on: string; skaters: string }>(
    `SELECT e.id, e.slug, e.name, e.status, e.starts_on,
            (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.${ACTIVE}) AS skaters
       FROM events e ORDER BY e.starts_on DESC`,
  );
  const daily = await all<{ day: string; n: string }>(
    `SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COUNT(*) AS n FROM registrations
      WHERE created_at >= now() - interval '13 days' GROUP BY day ORDER BY day`,
  );
  const recent = await all<Record<string, unknown>>(
    `SELECT r.id, r.ref_code, r.first_name, r.last_name, r.status, r.created_at, c.name AS category, e.name AS event
       FROM registrations r JOIN categories c ON c.id = r.category_id JOIN events e ON e.id = r.event_id
      ORDER BY r.id DESC LIMIT 8`,
  );
  return json({
    registrations,
    total_registrations: Object.values(registrations).reduce((a, b) => a + b, 0),
    unread_messages: Number(unread?.n ?? 0),
    events: events.map((e) => ({ ...e, skaters: Number(e.skaters) })),
    daily: daily.map((d) => ({ day: d.day, n: Number(d.n) })),
    recent,
  });
});
