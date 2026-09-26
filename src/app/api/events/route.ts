import { getPublicEvents } from '@/lib/queries';
import { handle, json } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async () => json({ events: await getPublicEvents() }));
