import { all, one } from '@/lib/db';
import { handle, json } from '@/lib/api';
import { ageOn } from '@/lib/domain';
import { requireAdmin } from '../_guard';
import { REG_SELECT, regFilters, type AdminRegistration } from './_filters';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  const params = new URL(req.url).searchParams;
  const f = regFilters(params);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const size = Math.min(200, Math.max(10, Number(params.get('size')) || 50));

  const total = await one<{ n: string }>(`SELECT COUNT(*) AS n FROM registrations r ${f.sql}`, f.values);
  const rows = await all<AdminRegistration>(
    `${REG_SELECT} ${f.sql} ORDER BY r.id DESC LIMIT $${f.values.length + 1} OFFSET $${f.values.length + 2}`,
    [...f.values, size, (page - 1) * size],
  );

  return json({
    total: Number(total?.n ?? 0),
    page,
    size,
    registrations: rows.map(({ identity_key, ...r }) => ({ ...r, age_on_race_day: ageOn(r.date_of_birth, r.starts_on) })),
  });
});
