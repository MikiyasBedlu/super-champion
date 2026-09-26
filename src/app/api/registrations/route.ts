import { one, tx } from '@/lib/db';
import { badRequest, clientIp, conflict, handle, HttpError, json, notFound, rateLimit, readJson } from '@/lib/api';
import { registrationSchema } from '@/lib/validation';
import { refCode } from '@/lib/auth';
import { ACTIVE, ageOn, categoryFits, identityKey, registrationState, type CategoryRow, type EventRow } from '@/lib/domain';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  rateLimit('register', clientIp(req));
  const v = registrationSchema.parse(await readJson(req));

  // Hidden field filled in means a bot. Reply as if it worked, save nothing.
  if (v.website) return json({ ref_code: 'SC-000000', status: 'pending' }, 201);

  const ev = await one<EventRow>(`SELECT * FROM events WHERE slug = $1 AND status <> 'draft'`, [v.event_slug]);
  if (!ev) throw notFound('That event does not exist.');
  const startsOn = ev.starts_on;

  const state = registrationState(ev);
  if (state !== 'open') {
    throw new HttpError(
      409,
      state === 'not_yet_open'
        ? `Registration opens on ${ev.registration_opens_on}.`
        : 'Registration for this event is closed.',
    );
  }

  const cat = await one<CategoryRow>('SELECT * FROM categories WHERE id = $1 AND event_id = $2', [v.category_id, ev.id]);
  if (!cat) throw badRequest('Some fields need attention.', { category_id: 'Choose a category from this event.' });

  const age = ageOn(v.date_of_birth, startsOn);
  if (age < 3 || age > 90) throw badRequest('Some fields need attention.', { date_of_birth: 'Check the date of birth.' });
  if (!categoryFits(cat, age, v.gender)) {
    throw badRequest('Some fields need attention.', {
      category_id: `This category is for ages ${cat.min_age}–${cat.max_age}${cat.gender === 'open' ? '' : ` (${cat.gender})`}. The skater will be ${age} on race day.`,
    });
  }

  const errors: Record<string, string> = {};
  if (age < 18) {
    if (!v.guardian_name) errors.guardian_name = 'Skaters under 18 need a parent or guardian name.';
    if (!v.guardian_phone) errors.guardian_phone = "Skaters under 18 need a parent or guardian's phone.";
  }
  if (!v.consent) errors.consent = 'Tick the box to accept the competition rules and safety terms.';
  if (Object.keys(errors).length) throw badRequest('Some fields need attention.', errors);

  const key = identityKey(v.first_name, v.last_name, v.date_of_birth);

  const ref = await tx(async (t) => {
    if (cat.capacity !== null) {
      const taken = await t.one<{ n: string }>(`SELECT COUNT(*) AS n FROM registrations WHERE category_id = $1 AND ${ACTIVE}`, [cat.id]);
      if (Number(taken?.n ?? 0) >= cat.capacity) {
        throw conflict('This category is full. Choose another category or contact the organisers.');
      }
    }
    const dupe = await t.one<{ x: number }>(
      `SELECT 1 AS x FROM registrations WHERE event_id = $1 AND identity_key = $2 AND ${ACTIVE}`,
      [ev.id, key],
    );
    if (dupe) throw conflict('This skater is already registered for this event. Use "Check my registration" to see the status.');

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = refCode();
      const taken = await t.one<{ x: number }>('SELECT 1 AS x FROM registrations WHERE ref_code = $1', [code]);
      if (taken) continue;
      await t.run(
        `INSERT INTO registrations (ref_code, event_id, category_id, first_name, last_name, date_of_birth, gender, city, club,
           phone, email, guardian_name, guardian_phone, tshirt_size, notes, identity_key)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [code, ev.id, cat.id, v.first_name, v.last_name, v.date_of_birth, v.gender, v.city, v.club,
          v.phone, v.email, v.guardian_name, v.guardian_phone, v.tshirt_size, v.notes, key],
      );
      return code;
    }
    throw new Error('Could not allocate a reference code');
  });

  return json(
    {
      ref_code: ref,
      status: 'pending',
      skater: `${v.first_name} ${v.last_name}`,
      event: { name: ev.name, starts_on: startsOn, city: ev.city, venue: ev.venue },
      category: { name: cat.name, fee_birr: cat.fee_birr },
      age_on_race_day: age,
    },
    201,
  );
});
