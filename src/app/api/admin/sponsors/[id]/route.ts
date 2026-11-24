import { one, run } from '@/lib/db';
import { handle, json, notFound, readJson } from '@/lib/api';
import { sponsorSchema } from '@/lib/validation';
import { audit, requireAdmin } from '../../_guard';

export const dynamic = 'force-dynamic';

type SponsorRow = {
  id: number; event_id: number | null; name: string; tier: string; media_kind: string;
  media_url: string; poster_url: string; link_url: string; caption: string; is_active: boolean; sort_order: number;
};

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const id = Number((await ctx.params).id);
  const existing = await one<SponsorRow>('SELECT * FROM sponsors WHERE id = $1', [id]);
  if (!existing) throw notFound('Sponsor not found.');
  const v = sponsorSchema.partial().parse(await readJson(req));
  const m = { ...existing, ...v };
  const sponsor = await one<SponsorRow>(
    `UPDATE sponsors SET event_id=$1, name=$2, tier=$3, media_kind=$4, media_url=$5, poster_url=$6,
       link_url=$7, caption=$8, is_active=$9, sort_order=$10, updated_at=now() WHERE id=$11 RETURNING *`,
    [m.event_id, m.name, m.tier, m.media_kind, m.media_url, m.poster_url, m.link_url, m.caption, m.is_active, m.sort_order, id],
  );
  await audit(admin.id, 'update', 'sponsor', id, Object.keys(v).join(','));
  return json({ sponsor });
});

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin(req);
  const id = Number((await ctx.params).id);
  if (!(await run('DELETE FROM sponsors WHERE id = $1', [id]))) throw notFound('Sponsor not found.');
  await audit(admin.id, 'delete', 'sponsor', id);
  return json({ ok: true });
});
