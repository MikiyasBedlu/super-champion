/* Loads the starting content: the competition and its categories.
   No sample skaters and no sample results — every name in the system is a real entry.
   Run with: npm run seed        Replace existing content with: npm run seed -- --force */
import { pool, one, tx } from './db';
import { migrate } from './migrate';
import { bootstrapAdmin } from './auth';

// Hidar 13, 2019 (Ethiopian) = Sunday 22 November 2026.
const EVENT = {
  slug: 'super-champion-2026',
  name: 'Super Champion 2026',
  tagline: 'One day of speed and freestyle racing for every age.',
  description:
    'The first Super Champion competition. Sprint heats in the morning, finals and freestyle slalom in the afternoon. Every finisher receives a medal; podium skaters earn season points.',
  city: 'Adama',
  venue: 'Super Skate',
  starts_on: '2026-11-22',
  ends_on: '2026-11-22',
  registration_opens_on: '2026-09-24',
  registration_closes_on: '2026-11-15',
  status: 'open',
};

const CATEGORIES: [string, string, string, number, number, string, number, number][] = [
  ['Mini Speed U8', 'speed', 'open', 5, 7, '100 m', 300, 40],
  ['Speed U10', 'speed', 'open', 8, 9, '200 m', 400, 48],
  ['Speed U12 Girls', 'speed', 'female', 10, 11, '300 m', 400, 32],
  ['Speed U12 Boys', 'speed', 'male', 10, 11, '300 m', 400, 32],
  ['Speed U15 Girls', 'speed', 'female', 12, 14, '500 m', 500, 32],
  ['Speed U15 Boys', 'speed', 'male', 12, 14, '500 m', 500, 32],
  ['Speed Open Women', 'speed', 'female', 15, 99, '1000 m', 600, 40],
  ['Speed Open Men', 'speed', 'male', 15, 99, '1000 m', 600, 40],
  ['Freestyle Slalom Junior', 'freestyle', 'open', 8, 14, 'Judged run', 500, 24],
  ['Freestyle Slalom Senior', 'freestyle', 'open', 15, 99, 'Judged run', 600, 24],
];

const NEWS = {
  slug: 'registration-open-2026',
  title: 'Registration is open for Super Champion 2026',
  excerpt: 'Ten categories, from Mini Speed for five-year-olds to the Open 1000 m. Places are limited in every category.',
  body: `Registration for Super Champion 2026 is now open.

The competition takes place on Sunday 22 November 2026 (Hidar 13) at Super Skate in Adama. Sprint heats run in the morning; finals and the freestyle slalom follow in the afternoon.

Register on this website. You get a reference code straight away — keep it. You need it together with the phone number you registered with to check your status and your bib number.

Skaters under 18 must give a parent or guardian's name and phone number. Every skater needs a helmet, and skaters under 15 also need knee pads, elbow pads and wrist guards.`,
};

async function seed(force: boolean): Promise<void> {
  await migrate();
  await bootstrapAdmin();

  const existing = await one<{ n: string }>('SELECT COUNT(*) AS n FROM events');
  if (Number(existing?.n ?? 0) > 0 && !force) {
    console.log('The database already has events — nothing was loaded. Use --force to replace the content.');
    return;
  }

  await tx(async (t) => {
    if (force) for (const table of ['results', 'registrations', 'categories', 'events', 'news']) await t.run(`DELETE FROM ${table}`);

    const ev = await t.one<{ id: number }>(
      `INSERT INTO events (slug, name, tagline, description, city, venue, starts_on, ends_on, registration_opens_on, registration_closes_on, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [EVENT.slug, EVENT.name, EVENT.tagline, EVENT.description, EVENT.city, EVENT.venue, EVENT.starts_on, EVENT.ends_on,
        EVENT.registration_opens_on, EVENT.registration_closes_on, EVENT.status],
    );
    let order = 0;
    for (const [name, discipline, gender, minAge, maxAge, distance, fee, capacity] of CATEGORIES) {
      await t.run(
        `INSERT INTO categories (event_id, name, discipline, gender, min_age, max_age, distance, fee_birr, capacity, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [ev!.id, name, discipline, gender, minAge, maxAge, distance, fee, capacity, order++],
      );
    }
    await t.run('INSERT INTO news (slug, title, excerpt, body, is_published, published_at) VALUES ($1,$2,$3,$4,true,now())', [
      NEWS.slug, NEWS.title, NEWS.excerpt, NEWS.body,
    ]);
  });

  console.log(`Loaded ${EVENT.name} with ${CATEGORIES.length} categories.`);
}

seed(process.argv.includes('--force'))
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err.message);
    await pool.end();
    process.exit(1);
  });

