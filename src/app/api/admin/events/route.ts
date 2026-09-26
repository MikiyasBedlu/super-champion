import { all, one } from '@/lib/db';
import { conflict, handle, json, readJson } from '@/lib/api';
import { eventSchema, slugify } from '@/lib/validation';
import { categoriesWithCounts } from '@/lib/queries';
import type { EventRow } from '@/lib/domain';
import { audit, requireAdmin } from '../_guard';
import { checkEventDates } from './_dates';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const rows = await all<EventRow>('SELECT * FROM events ORDER BY starts_on DESC');
  const events = await Promise.all(rows.map(async (e) => ({ ...e, categories: await categoriesWithCounts(e.id) })));
  return json({ events });
});

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const v = eventSchema.parse(await readJson(req));
  const slug = v.slug || slugify(v.name);
  checkEventDates(v);
  if (await one('SELECT 1 FROM events WHERE slug = $1', [slug])) throw conflict('Another event already uses that URL name.');
  const created = await one<EventRow>(
    `INSERT INTO events (slug, name, tagline, description, city, venue, starts_on, ends_on, registration_opens_on, registration_closes_on, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [slug, v.name, v.tagline, v.description, v.city, v.venue, v.starts_on, v.ends_on, v.registration_opens_on, v.registration_closes_on, v.status],
  );
  await audit(admin.id, 'create', 'event', created!.id, v.name);
  return json({ event: created }, 201);
});

