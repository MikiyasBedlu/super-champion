import { handle, json } from '@/lib/api';
import { requireAdmin } from '../_guard';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  return json({ admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role } });
});
