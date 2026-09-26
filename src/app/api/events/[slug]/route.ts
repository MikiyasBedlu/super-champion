import { getPublicEvent } from '@/lib/queries';
import { handle, json, notFound } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const event = await getPublicEvent(slug);
  if (!event) throw notFound('That event does not exist.');
  return json({ event });
});
