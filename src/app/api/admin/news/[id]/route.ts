import { one, run } from '@/lib/db';
import { conflict, handle, json, notFound, readJson } from '@/lib/api';
import { newsSchema, slugify } from '@/lib/validation';
import { audit, requireAdmin } from '../../_guard';

export const dynamic = 'force-dynamic';

type NewsRow = { id: number; slug: string; title: string; excerpt: string; body: string; is_published: boolean; published_at: string | null };

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const id = Number((await ctx.params).id);
  const existing = await one<NewsRow>('SELECT * FROM news WHERE id = $1', [id]);
  if (!existing) throw notFound('Story not found.');
  const v = newsSchema.partial().parse(await readJson(req));
  const m = { ...existing, ...v };
  const slug = m.slug || slugify(m.title);
  if (slug !== existing.slug && (await one('SELECT 1 FROM news WHERE slug = $1 AND id <> $2', [slug, id]))) {
    throw conflict('Another story already uses that URL name.');
  }
  const publishedAt = m.is_published ? (existing.published_at ?? new Date().toISOString()) : null;
  const news = await one<NewsRow>(
    `UPDATE news SET slug=$1, title=$2, excerpt=$3, body=$4, is_published=$5, published_at=$6, updated_at=now() WHERE id=$7 RETURNING *`,
    [slug, m.title, m.excerpt, m.body, m.is_published, publishedAt, id],
  );
  await audit(admin.id, 'update', 'news', id);
  return json({ news });
});

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const id = Number((await ctx.params).id);
  if (!(await run('DELETE FROM news WHERE id = $1', [id]))) throw notFound('Story not found.');
  await audit(admin.id, 'delete', 'news', id);
  return json({ ok: true });
});
