import { one } from '@/lib/db';
import { badRequest, conflict, handle, json, notFound, readJson } from '@/lib/api';
import { registrationPatchSchema } from '@/lib/validation';
import { ACTIVE, ageOn } from '@/lib/domain';
import { audit, requireAdmin } from '../../_guard';
import { REG_SELECT, type AdminRegistration } from '../_filters';

export const dynamic = 'force-dynamic';

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const id = Number((await ctx.params).id);
  const reg = await one<AdminRegistration>('SELECT * FROM registrations WHERE id = $1', [id]);
  if (!reg) throw notFound('Registration not found.');
  const v = registrationPatchSchema.parse(await readJson(req));

  if (v.category_id && v.category_id !== reg.category_id) {
    const cat = await one('SELECT 1 FROM categories WHERE id = $1 AND event_id = $2', [v.category_id, reg.event_id]);
    if (!cat) throw badRequest('Some fields need attention.', { category_id: 'That category is not part of this event.' });
  }
  if (v.bib_number != null) {
    const taken = await one('SELECT 1 FROM registrations WHERE event_id = $1 AND bib_number = $2 AND id <> $3', [reg.event_id, v.bib_number, id]);
    if (taken) throw conflict(`Bib ${v.bib_number} is already taken in this event.`);
  }
  // Re-activating a rejected or withdrawn entry must not create a second active skater.
  if (v.status && !['rejected', 'withdrawn'].includes(v.status) && ['rejected', 'withdrawn'].includes(reg.status)) {
    const clash = await one(`SELECT 1 FROM registrations WHERE event_id = $1 AND identity_key = $2 AND id <> $3 AND ${ACTIVE}`, [
      reg.event_id, reg.identity_key, id,
    ]);
    if (clash) throw conflict('This skater already has another active registration for this event.');
  }

  const m = { ...reg, ...v };
  await one(
    `UPDATE registrations SET status=$1, bib_number=$2, admin_note=$3, category_id=$4, updated_at=now() WHERE id=$5`,
    [m.status, m.bib_number, m.admin_note, m.category_id, id],
  );
  await audit(admin.id, 'update', 'registration', id, v);
  const row = await one<AdminRegistration>(`${REG_SELECT} WHERE r.id = $1`, [id]);
  if (!row) throw notFound('Registration not found.');
  const { identity_key, ...rest } = row;
  void identity_key;
  return json({ registration: { ...rest, age_on_race_day: ageOn(rest.date_of_birth, rest.starts_on) } });
});
