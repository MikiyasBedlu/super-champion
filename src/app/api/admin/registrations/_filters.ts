/** Shared WHERE clause for the registration list and the CSV export. */
export function regFilters(params: URLSearchParams): { sql: string; values: unknown[] } {
  const where: string[] = [];
  const values: unknown[] = [];

  const eventId = Number(params.get('event'));
  if (eventId) {
    values.push(eventId);
    where.push(`r.event_id = $${values.length}`);
  }

  const status = params.get('status');
  if (status && ['pending', 'approved', 'rejected', 'withdrawn', 'checked_in'].includes(status)) {
    values.push(status);
    where.push(`r.status = $${values.length}`);
  }

  const category = Number(params.get('category'));
  if (category) {
    values.push(category);
    where.push(`r.category_id = $${values.length}`);
  }

  const q = (params.get('q') ?? '').trim().slice(0, 60);
  if (q) {
    values.push(`%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
    const like = values.length;
    values.push(q);
    const exact = values.length;
    where.push(
      `((r.first_name || ' ' || r.last_name) ILIKE $${like} ESCAPE '\\' OR r.ref_code ILIKE $${like} ESCAPE '\\'
        OR r.phone ILIKE $${like} ESCAPE '\\' OR r.club ILIKE $${like} ESCAPE '\\' OR CAST(r.bib_number AS TEXT) = $${exact})`,
    );
  }

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

export const REG_SELECT = `
  SELECT r.*, c.name AS category_name, c.discipline, c.fee_birr, e.name AS event_name, e.starts_on
    FROM registrations r JOIN categories c ON c.id = r.category_id JOIN events e ON e.id = r.event_id`;

export type AdminRegistration = {
  id: number;
  ref_code: string;
  event_id: number;
  category_id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: 'male' | 'female';
  city: string;
  club: string;
  phone: string;
  email: string;
  guardian_name: string;
  guardian_phone: string;
  tshirt_size: string;
  notes: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn' | 'checked_in';
  bib_number: number | null;
  admin_note: string;
  identity_key: string;
  created_at: string;
  updated_at: string;
  category_name: string;
  discipline: string;
  fee_birr: number;
  event_name: string;
  starts_on: string;
};
