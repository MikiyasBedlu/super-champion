import { one } from '@/lib/db';
import { handle, json } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => {
  await one('SELECT 1 AS ok');
  return json({ ok: true, time: new Date().toISOString() });
});
