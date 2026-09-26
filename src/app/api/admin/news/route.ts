import { all, one } from '@/lib/db';
import { conflict, handle, json, readJson } from '@/lib/api';
import { newsSchema, slugify } from '@/lib/validation';
import { audit, requireAdmin } from '../_guard';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  await requireAdmin(req);
  return json({ news: await all('SELECT * FROM news ORDER BY COALESCE(published_at, created_at) DESC') });
});

export const POST = handle(async (req: Request) => {
  const admin = await requireAdmin(req);
  const v = newsSchema.parse(await readJson(req));
  const slug = v.slug || slugify(v.title);
  if (await one('SELECT 1 FROM news WHERE slug = $1', [slug])) throw conflict('Another story already uses that URL name.');
  const news = await one<{ id: number }>(
    `INSERT INTO news (slug, title, excerpt, body, is_published, published_at)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [slug, v.title, v.excerpt, v.body, v.is_published, v.is_published ? new Date().toISOString() : null],
  );
  await audit(admin.id, 'create', 'news', news!.id, v.title);
  return json({ news }, 201);
});
