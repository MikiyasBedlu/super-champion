import { all } from '@/lib/db';
import { handle, json } from '@/lib/api';
import { requireAdmin } from '../_guard';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  return json({ messages: await all('SELECT * FROM messages ORDER BY is_read, id DESC LIMIT 300') });
});
