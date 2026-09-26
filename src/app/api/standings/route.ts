import { getStandings } from '@/lib/queries';
import { handle, json } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const url = new URL(req.url);
  return json(await getStandings(url.searchParams.get('year') ?? undefined, url.searchParams.get('discipline')));
});
