import { all } from '@/lib/db';
import { handle, json } from '@/lib/api';
import { requireAdmin, requireOwner } from '../_guard';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  requireOwner(admin);
  const entries = await all(
    `SELECT a.*, ad.name AS admin_name FROM audit_log a LEFT JOIN admins ad ON ad.id = a.admin_id ORDER BY a.id DESC LIMIT 200`,
  );
  return json({ entries });
});
