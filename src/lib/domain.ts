import type { Lang } from './dictionaries';

export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1] as const;

export const pointsFor = (position: number | null, outcome: string): number =>
  outcome === 'finished' && position !== null && position >= 1 && position <= POINTS.length ? POINTS[position - 1] : 0;

export const today = (): string => new Date().toISOString().slice(0, 10);

/** Age on a given day. Both dates are YYYY-MM-DD. */
export function ageOn(dob: string, onDate: string): number {
  const [by, bm, bd] = dob.slice(0, 10).split('-').map(Number);
  const [y, m, d] = onDate.slice(0, 10).split('-').map(Number);
  let age = y - by;
  if (m < bm || (m === bm && d < bd)) age--;
  return age;
}

export function identityKey(first: string, last: string, dob: string): string {
  const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();
  return `${norm(first)}|${norm(last)}|${dob.slice(0, 10)}`;
}

export type EventRow = {
  id: number;
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
  status: 'draft' | 'open' | 'closed' | 'completed';
};

export type CategoryRow = {
  id: number;
  event_id: number;
  name: string;
  discipline: 'speed' | 'freestyle' | 'slalom' | 'relay';
  gender: 'open' | 'male' | 'female';
  min_age: number;
  max_age: number;
  distance: string;
  fee_birr: number;
  capacity: number | null;
  sort_order: number;
};

export type PublicCategory = Omit<CategoryRow, 'event_id' | 'sort_order'> & { taken: number; spots_left: number | null };

export type RegistrationState = 'open' | 'not_yet_open' | 'closed' | 'completed';

export function registrationState(ev: Pick<EventRow, 'status' | 'registration_opens_on' | 'registration_closes_on'>): RegistrationState {
  const t = today();
  if (ev.status === 'completed') return 'completed';
  if (ev.status !== 'open') return 'closed';
  if (t < ev.registration_opens_on.slice(0, 10)) return 'not_yet_open';
  if (t > ev.registration_closes_on.slice(0, 10)) return 'closed';
  return 'open';
}

export const categoryFits = (c: Pick<CategoryRow, 'min_age' | 'max_age' | 'gender'>, age: number, gender: string): boolean =>
  age >= c.min_age && age <= c.max_age && (c.gender === 'open' || c.gender === gender);

/** Same check, but an empty gender means "not chosen yet" and matches every category. */
export const categoryMayFit = (c: Pick<CategoryRow, 'min_age' | 'max_age' | 'gender'>, age: number, gender: string): boolean =>
  age >= c.min_age && age <= c.max_age && (c.gender === 'open' || !gender || c.gender === gender);

/** Everything except rejected and withdrawn takes a place. */
export const ACTIVE = "status NOT IN ('rejected','withdrawn')";

/* ---------- Dates ---------- */
const EC_MONTHS = ['መስከረም', 'ጥቅምት', 'ህዳር', 'ታህሳስ', 'ጥር', 'የካቲት', 'መጋቢት', 'ሚያዝያ', 'ግንቦት', 'ሰኔ', 'ሐምሌ', 'ነሐሴ', 'ጳጉሜ'];

/** Gregorian YYYY-MM-DD to the Ethiopian calendar. */
export function toEthiopic(iso: string): { year: number; month: number; day: number } {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  const jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);
  return {
    year: 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460),
    month: Math.floor(n / 30) + 1,
    day: (n % 30) + 1,
  };
}

export type DateStyle = 'full' | 'dayMonth' | 'monthYear';

/** Amharic uses the Ethiopian calendar, English the Gregorian one — the same day either way. */
export function formatDate(iso: string, lang: Lang, style: DateStyle = 'full'): string {
  if (!iso) return '';
  if (lang === 'am') {
    const e = toEthiopic(iso);
    const name = EC_MONTHS[e.month - 1];
    if (style === 'monthYear') return `${name} ${e.year} ዓ.ም`;
    if (style === 'dayMonth') return `${name} ${e.day}`;
    return `${name} ${e.day} ቀን ${e.year} ዓ.ም`;
  }
  const opts: Intl.DateTimeFormatOptions =
    style === 'monthYear'
      ? { month: 'short', year: 'numeric' }
      : style === 'dayMonth'
        ? { day: 'numeric', month: 'long' }
        : { day: 'numeric', month: 'long', year: 'numeric' };
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(iso.slice(0, 10) + 'T00:00:00Z'));
}

export function formatDateTime(iso: string): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** Milliseconds to 1:02.345 (or 38.400 under a minute). */
export function formatTime(ms: number | null): string {
  if (ms === null || ms === undefined) return '';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const t = ms % 1000;
  return `${m ? `${m}:${String(s).padStart(2, '0')}` : s}.${String(t).padStart(3, '0')}`;
}

/** Parses 1:02.345, 62.345 or 38.4 into milliseconds. Returns null for empty, NaN for nonsense. */
export function parseTime(value: string): number | null | typeof NaN {
  const s = String(value ?? '').trim();
  if (!s) return null;
  const m = /^(?:(\d+):)?(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(s);
  if (!m) return NaN;
  return (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000 + Number((m[3] ?? '0').padEnd(3, '0'));
}

/** Spreadsheet-safe CSV with a UTF-8 marker, so Amharic names open correctly in Excel. */
export function toCsv<R extends Record<string, unknown>>(rows: R[], columns: [keyof R & string, string][]): string {
  const cell = (v: unknown): string => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(([, header]) => cell(header)).join(',')];
  for (const row of rows) lines.push(columns.map(([key]) => cell(row[key])).join(','));
  return '\uFEFF' + lines.join('\r\n');
}
