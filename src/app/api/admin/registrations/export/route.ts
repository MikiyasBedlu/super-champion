import { all } from '@/lib/db';
import { handle } from '@/lib/api';
import { ageOn, toCsv, today } from '@/lib/domain';
import { audit, requireAdmin } from '../../_guard';
import { REG_SELECT, regFilters, type AdminRegistration } from '../_filters';

export const dynamic = 'force-dynamic';

/** CSV for Excel: formulas are neutralised and a UTF-8 marker keeps Amharic names readable. */
export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const f = regFilters(new URL(req.url).searchParams);
  const rows = await all<AdminRegistration>(`${REG_SELECT} ${f.sql} ORDER BY c.sort_order, r.bib_number, r.last_name`, f.values);
  const withAge = rows.map((r) => ({ ...r, age_on_race_day: ageOn(r.date_of_birth, r.starts_on) }));
  const csv = toCsv(withAge, [
    ['ref_code', 'Reference'], ['bib_number', 'Bib'], ['status', 'Status'], ['event_name', 'Event'], ['category_name', 'Category'],
    ['first_name', 'First name'], ['last_name', 'Last name'], ['gender', 'Gender'], ['date_of_birth', 'Date of birth'],
    ['age_on_race_day', 'Age on race day'], ['club', 'Club'], ['city', 'City'], ['phone', 'Phone'], ['email', 'Email'],
    ['guardian_name', 'Guardian'], ['guardian_phone', 'Guardian phone'], ['tshirt_size', 'T-shirt'], ['fee_birr', 'Fee (Birr)'],
    ['notes', 'Notes'], ['admin_note', 'Admin note'], ['created_at', 'Registered at'],
  ]);
  await audit(admin.id, 'export', 'registration', null, `${rows.length} rows`);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="super-champion-registrations-${today()}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
});
