import { one } from '@/lib/db';
import { badRequest, clientIp, handle, json, notFound, rateLimit } from '@/lib/api';
import { normalisePhone } from '@/lib/validation';

export const dynamic = 'force-dynamic';

/* Needs the reference code AND the phone number, so codes cannot be guessed.
   Only a shortened name is returned, never the phone number or date of birth. */
export const GET = handle(async (req: Request) => {
  rateLimit('lookup', clientIp(req));
  const url = new URL(req.url);
  const ref = (url.searchParams.get('ref') ?? '').trim().toUpperCase();
  const phone = normalisePhone(url.searchParams.get('phone'));
  if (!/^SC-[A-Z0-9]{6}$/.test(ref) || !phone) {
    throw badRequest('Enter your reference code (like SC-7KQ4XM) and the phone number you registered with.');
  }
  const row = await one<{
    ref_code: string; first_name: string; last_name: string; status: string; bib_number: number | null;
    created_at: Date; event_name: string; starts_on: string; city: string; venue: string; category_name: string; fee_birr: number;
  }>(
    `SELECT r.ref_code, r.first_name, r.last_name, r.status, r.bib_number, r.created_at,
            e.name AS event_name, e.starts_on, e.city, e.venue, c.name AS category_name, c.fee_birr
       FROM registrations r JOIN events e ON e.id = r.event_id JOIN categories c ON c.id = r.category_id
      WHERE r.ref_code = $1 AND (r.phone = $2 OR r.guardian_phone = $2)`,
    [ref, phone],
  );
  if (!row) throw notFound('No registration matches that code and phone number.');
  return json({
    ref_code: row.ref_code,
    skater: `${row.first_name} ${row.last_name.charAt(0)}.`,
    status: row.status,
    bib_number: row.bib_number,
    event: { name: row.event_name, starts_on: row.starts_on, city: row.city, venue: row.venue },
    category: { name: row.category_name, fee_birr: row.fee_birr },
    registered_at: new Date(row.created_at).toISOString(),
  });
});
