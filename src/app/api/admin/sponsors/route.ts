import { all, one } from '@/lib/db';
import { handle, json, readJson } from '@/lib/api';
import { sponsorSchema } from '@/lib/validation';
import { audit, requireAdmin } from '../_guard';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const sponsors = await all(
    `SELECT s.*, e.name AS event_name FROM sponsors s LEFT JOIN events e ON e.id = s.event_id
      ORDER BY CASE s.tier WHEN 'headline' THEN 0 WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 ELSE 3 END, s.sort_order, s.id`,
  );
  return json({ sponsors });
});

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const v = sponsorSchema.parse(await readJson(req));
  const sponsor = await one<{ id: number }>(
    `INSERT INTO sponsors (event_id, name, tier, media_kind, media_url, poster_url, link_url, caption, is_active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [v.event_id, v.name, v.tier, v.media_kind, v.media_url, v.poster_url, v.link_url, v.caption, v.is_active, v.sort_order],
  );
  await audit(admin.id, 'create', 'sponsor', sponsor!.id, v.name);
  return json({ sponsor }, 201);
});
