import { getNewsItem } from '@/lib/queries';
import { handle, json, notFound } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  const { slug } = await ctx.params;
  const news = await getNewsItem(slug);
  if (!news) throw notFound('That story does not exist.');
  return json({ news });
});
