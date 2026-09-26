import { one, run } from '@/lib/db';
import { conflict, handle, json, notFound, readJson } from '@/lib/api';
import { eventSchema, slugify } from '@/lib/validation';
import type { EventRow } from '@/lib/domain';
import { audit, requireAdmin, requireOwner } from '../../_guard';
import { checkEventDates } from '../_dates';

export const dynamic = 'force-dynamic';

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const id = Number((await ctx.params).id);
  const ev = await one<EventRow>('SELECT * FROM events WHERE id = $1', [id]);
  if (!ev) throw notFound('Event not found.');
  const v = eventSchema.partial().parse(await readJson(req));
  const m = { ...ev, ...v };
  const slug = m.slug || slugify(m.name);
  checkEventDates(m);
  if (slug !== ev.slug && (await one('SELECT 1 FROM events WHERE slug = $1 AND id <> $2', [slug, id]))) {
    throw conflict('Another event already uses that URL name.');
  }
  const updated = await one<EventRow>(
    `UPDATE events SET slug=$1, name=$2, tagline=$3, description=$4, city=$5, venue=$6, starts_on=$7, ends_on=$8,
       registration_opens_on=$9, registration_closes_on=$10, status=$11, updated_at=now() WHERE id=$12 RETURNING *`,
    [slug, m.name, m.tagline, m.description, m.city, m.venue, m.starts_on, m.ends_on, m.registration_opens_on, m.registration_closes_on, m.status, id],
  );
  await audit(admin.id, 'update', 'event', id, Object.keys(v).join(','));
  return json({ event: updated });
});

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  requireOwner(admin);
  const id = Number((await ctx.params).id);
  const ev = await one<EventRow>('SELECT * FROM events WHERE id = $1', [id]);
  if (!ev) throw notFound('Event not found.');
  if (await one('SELECT 1 FROM registrations WHERE event_id = $1 LIMIT 1', [id])) {
    throw conflict('This event has registrations. Set its status to closed instead of deleting it.');
  }
  await run('DELETE FROM events WHERE id = $1', [id]);
  await audit(admin.id, 'delete', 'event', id, ev.name);
  return json({ ok: true });
});
