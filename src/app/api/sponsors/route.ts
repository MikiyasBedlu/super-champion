import { getSponsors } from '@/lib/queries';
import { handle, json } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const slug = new URL(req.url).searchParams.get('event');
  return json({ sponsors: await getSponsors(slug) });
});
