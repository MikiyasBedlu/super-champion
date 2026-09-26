'use client';

import { useEffect, useRef, useState } from 'react';
import { translator, type Lang } from '@/lib/dictionaries';
import { formatDate } from '@/lib/domain';
import { apiFetch } from '@/lib/client';
import type { NewsItem } from '@/lib/queries';

export default function NewsList({ lang, news }: { lang: Lang; news: NewsItem[] }) {
  const t = translator(lang);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState<NewsItem | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (open && !dlg.open) dlg.showModal();
    if (!open && dlg.open) dlg.close();
  }, [open]);

  async function read(slug: string) {
    const r = await apiFetch<{ news: NewsItem }>(`/api/news/${encodeURIComponent(slug)}`, { networkMessage: t('err.network') });
    setOpen(r.news);
  }

  if (!news.length) return <p className="muted">{t('news.empty')}</p>;

  return (
    <>
      <div className="news-list">
        {news.map((n) => (
          <article className="news-item" key={n.slug}>
            <time dateTime={n.published_at}>{formatDate(n.published_at, lang)}</time>
            <div>
              <h3>{n.title}</h3>
              <p>{n.excerpt}</p>
            </div>
            <button type="button" className="link-btn" onClick={() => read(n.slug)}>
              {t('news.read')}
            </button>
          </article>
        ))}
      </div>

      <dialog className="modal" ref={dialogRef} onClose={() => setOpen(null)} onClick={(e) => e.target === dialogRef.current && setOpen(null)}>
        {open && (
          <article>
            <button className="modal-x" type="button" aria-label="Close" onClick={() => setOpen(null)}>
              ×
            </button>
            <p className="modal-date">{formatDate(open.published_at, lang)}</p>
            <h2>{open.title}</h2>
            <div className="modal-body">
              {(open.body ?? '').split(/\n{2,}/).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </article>
        )}
      </dialog>
    </>
  );
}
