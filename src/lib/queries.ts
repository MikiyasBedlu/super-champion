import { all, one } from './db';
import { ACTIVE, POINTS, registrationState, type CategoryRow, type EventRow, type PublicCategory, type RegistrationState } from './domain';

export type PublicEvent = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  city: string;
  venue: string;
  starts_on: string;
  ends_on: string;
  registration_opens_on: string;
  registration_closes_on: string;
  status: EventRow['status'];
  registration: RegistrationState;
  skaters: number;
  has_results: boolean;
  categories?: PublicCategory[];
};

const d = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? '').slice(0, 10));

export async function categoriesWithCounts(eventId: number): Promise<PublicCategory[]> {
  const rows = await all<CategoryRow & { taken: string }>(
    `SELECT c.*, (SELECT COUNT(*) FROM registrations r WHERE r.category_id = c.id AND r.${ACTIVE}) AS taken
       FROM categories c WHERE c.event_id = $1 ORDER BY c.sort_order, c.min_age, c.id`,
    [eventId],
  );
  return rows.map((c) => {
    const taken = Number(c.taken);
    return {
      id: c.id,
      name: c.name,
      discipline: c.discipline,
      gender: c.gender,
      min_age: c.min_age,
      max_age: c.max_age,
      distance: c.distance,
      fee_birr: c.fee_birr,
      capacity: c.capacity,
      taken,
      spots_left: c.capacity === null ? null : Math.max(0, c.capacity - taken),
    };
  });
}

export async function toPublicEvent(ev: EventRow, withCategories = false): Promise<PublicEvent> {
  const normalised: EventRow = {
    ...ev,
    starts_on: d(ev.starts_on),
    ends_on: d(ev.ends_on),
    registration_opens_on: d(ev.registration_opens_on),
    registration_closes_on: d(ev.registration_closes_on),
  };
  const counts = await one<{ n: string }>(`SELECT COUNT(*) AS n FROM registrations WHERE event_id = $1 AND ${ACTIVE}`, [ev.id]);
  const results = await one<{ x: number }>('SELECT 1 AS x FROM results WHERE event_id = $1 LIMIT 1', [ev.id]);
  return {
    slug: normalised.slug,
    name: normalised.name,
    tagline: normalised.tagline,
    description: normalised.description,
    city: normalised.city,
    venue: normalised.venue,
    starts_on: normalised.starts_on,
    ends_on: normalised.ends_on,
    registration_opens_on: normalised.registration_opens_on,
    registration_closes_on: normalised.registration_closes_on,
    status: normalised.status,
    registration: registrationState(normalised),
    skaters: Number(counts?.n ?? 0),
    has_results: Boolean(results),
    ...(withCategories ? { categories: await categoriesWithCounts(ev.id) } : {}),
  };
}

export type SiteSummary = {
  next_event: PublicEvent | null;
  totals: { skaters: number; cities: number; clubs: number; events: number };
};

export async function getSiteSummary(): Promise<SiteSummary> {
  const ev = await one<EventRow>(
    `SELECT * FROM events WHERE status IN ('open','closed') AND ends_on >= CURRENT_DATE ORDER BY starts_on LIMIT 1`,
  );
  const totals = await one<{ skaters: string; cities: string; clubs: string }>(
    `SELECT COUNT(*) AS skaters, COUNT(DISTINCT lower(city)) AS cities,
            COUNT(DISTINCT CASE WHEN club <> '' THEN lower(club) END) AS clubs
       FROM registrations WHERE ${ACTIVE}`,
  );
  const events = await one<{ n: string }>(`SELECT COUNT(*) AS n FROM events WHERE status <> 'draft'`);
  return {
    next_event: ev ? await toPublicEvent(ev, true) : null,
    totals: {
      skaters: Number(totals?.skaters ?? 0),
      cities: Number(totals?.cities ?? 0),
      clubs: Number(totals?.clubs ?? 0),
      events: Number(events?.n ?? 0),
    },
  };
}

export async function getPublicEvents(): Promise<PublicEvent[]> {
  const rows = await all<EventRow>(`SELECT * FROM events WHERE status <> 'draft' ORDER BY starts_on DESC`);
  return Promise.all(rows.map((e) => toPublicEvent(e)));
}

export async function getPublicEvent(slug: string, withCategories = true): Promise<PublicEvent | null> {
  const ev = await one<EventRow>(`SELECT * FROM events WHERE slug = $1 AND status <> 'draft'`, [slug]);
  return ev ? toPublicEvent(ev, withCategories) : null;
}

export type ResultEntry = {
  position: number | null;
  time_ms: number | null;
  score: number | null;
  points: number;
  outcome: 'finished' | 'dnf' | 'dns' | 'dq';
  bib_number: number | null;
  name: string;
  club: string;
  city: string;
};
export type ResultCategory = { id: number; name: string; discipline: string; distance: string; entries: ResultEntry[] };

export async function getEventResults(slug: string): Promise<{ event: PublicEvent; categories: ResultCategory[] } | null> {
  const ev = await one<EventRow>(`SELECT * FROM events WHERE slug = $1 AND status <> 'draft'`, [slug]);
  if (!ev) return null;
  const rows = await all<{
    category_id: number;
    position: number | null;
    time_ms: number | null;
    score: string | null;
    points: number;
    outcome: ResultEntry['outcome'];
    first_name: string;
    last_name: string;
    club: string;
    city: string;
    bib_number: number | null;
  }>(
    `SELECT res.category_id, res.position, res.time_ms, res.score, res.points, res.outcome,
            r.first_name, r.last_name, r.club, r.city, r.bib_number
       FROM results res JOIN registrations r ON r.id = res.registration_id
      WHERE res.event_id = $1
      ORDER BY res.category_id, CASE res.outcome WHEN 'finished' THEN 0 ELSE 1 END, res.position, res.time_ms`,
    [ev.id],
  );
  const cats = await categoriesWithCounts(ev.id);
  const categories: ResultCategory[] = cats
    .map((c) => ({
      id: c.id,
      name: c.name,
      discipline: c.discipline,
      distance: c.distance,
      entries: rows
        .filter((x) => x.category_id === c.id)
        .map((x) => ({
          position: x.position,
          time_ms: x.time_ms,
          score: x.score === null ? null : Number(x.score),
          points: x.points,
          outcome: x.outcome,
          bib_number: x.bib_number,
          name: `${x.first_name} ${x.last_name}`,
          club: x.club,
          city: x.city,
        })),
    }))
    .filter((c) => c.entries.length > 0);
  return { event: await toPublicEvent(ev), categories };
}

export type StandingRow = { rank: number; name: string; club: string; city: string; points: number; events: number; wins: number; podiums: number };

export async function getStandings(year?: string, discipline?: string | null): Promise<{ year: number; discipline: string | null; points_table: number[]; standings: StandingRow[] }> {
  const y = /^\d{4}$/.test(year ?? '') ? (year as string) : String(new Date().getFullYear());
  const disc = discipline && ['speed', 'freestyle', 'slalom', 'relay'].includes(discipline) ? discipline : null;
  const rows = await all<{ name: string; club: string; city: string; points: string; events: string; wins: string; podiums: string }>(
    `SELECT MAX(r.first_name || ' ' || r.last_name) AS name, MAX(r.club) AS club, MAX(r.city) AS city,
            SUM(res.points) AS points, COUNT(DISTINCT res.event_id) AS events,
            SUM(CASE WHEN res.position = 1 AND res.outcome = 'finished' THEN 1 ELSE 0 END) AS wins,
            SUM(CASE WHEN res.position <= 3 AND res.outcome = 'finished' THEN 1 ELSE 0 END) AS podiums
       FROM results res
       JOIN registrations r ON r.id = res.registration_id
       JOIN events e ON e.id = res.event_id
       JOIN categories c ON c.id = res.category_id
      WHERE to_char(e.starts_on, 'YYYY') = $1 AND ($2::text IS NULL OR c.discipline = $2)
      GROUP BY r.identity_key
     HAVING SUM(res.points) > 0
      ORDER BY points DESC, wins DESC, podiums DESC, name
      LIMIT 50`,
    [y, disc],
  );
  return {
    year: Number(y),
    discipline: disc,
    points_table: [...POINTS],
    standings: rows.map((r, i) => ({
      rank: i + 1,
      name: r.name,
      club: r.club,
      city: r.city,
      points: Number(r.points),
      events: Number(r.events),
      wins: Number(r.wins),
      podiums: Number(r.podiums),
    })),
  };
}

export type NewsItem = { slug: string; title: string; excerpt: string; published_at: string; body?: string };

export async function getNews(): Promise<NewsItem[]> {
  const rows = await all<{ slug: string; title: string; excerpt: string; published_at: Date | string }>(
    `SELECT slug, title, excerpt, published_at FROM news WHERE is_published ORDER BY published_at DESC LIMIT 24`,
  );
  return rows.map((n) => ({ ...n, published_at: new Date(n.published_at).toISOString() }));
}

export async function getNewsItem(slug: string): Promise<NewsItem | null> {
  const n = await one<{ slug: string; title: string; excerpt: string; body: string; published_at: Date | string }>(
    `SELECT slug, title, excerpt, body, published_at FROM news WHERE slug = $1 AND is_published`,
    [slug],
  );
  return n ? { ...n, published_at: new Date(n.published_at).toISOString() } : null;
}
