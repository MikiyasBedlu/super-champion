'use client';

import { useState } from 'react';
import { translator, type Lang } from '@/lib/dictionaries';
import { formatDate, formatTime } from '@/lib/domain';
import { apiFetch } from '@/lib/client';
import type { PublicEvent, ResultCategory, StandingRow } from '@/lib/queries';

type ResultsData = { categories: ResultCategory[] } | null;

export default function ResultsPanel({
  lang,
  events,
  initialResults,
  standings,
  pointsTable,
  year,
}: {
  lang: Lang;
  events: PublicEvent[];
  initialResults: ResultsData;
  standings: StandingRow[];
  pointsTable: number[];
  year: number;
}) {
  const t = translator(lang);
  const withResults = events.filter((e) => e.has_results);
  const [slug, setSlug] = useState(withResults[0]?.slug ?? '');
  const [data, setData] = useState<ResultsData>(initialResults);
  const [catId, setCatId] = useState<number | null>(initialResults?.categories[0]?.id ?? null);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(false);

  async function pickEvent(next: string) {
    setSlug(next);
    setLoading(true);
    try {
      const r = await apiFetch<{ categories: ResultCategory[] }>(`/api/events/${encodeURIComponent(next)}/results`, {
        networkMessage: t('err.network'),
      });
      setData(r);
      setCatId(r.categories[0]?.id ?? null);
    } finally {
      setLoading(false);
    }
  }

  const category = data?.categories.find((c) => c.id === catId) ?? null;
  const isTimed = category?.entries.some((e) => e.time_ms !== null) ?? false;
  const perf = (e: ResultCategory['entries'][number]) =>
    e.outcome !== 'finished' ? e.outcome.toUpperCase() : e.time_ms !== null ? formatTime(e.time_ms) : e.score !== null ? t('res.pts', { n: e.score }) : '';
  const podium = category?.entries.filter((e) => e.outcome === 'finished' && e.position !== null && e.position <= 3) ?? [];
  const rows = showAll ? standings : standings.slice(0, 10);

  return (
    <>
      <div className="sec-head sec-head-row">
        <h2 className="display">{t('res.title')}</h2>
        {withResults.length > 1 && (
          <label className="inline-select">
            <span className="lbl">{t('res.event')}</span>
            <select value={slug} onChange={(e) => pickEvent(e.target.value)}>
              {withResults.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {`${e.name} · ${formatDate(e.starts_on, lang, 'monthYear')}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {data && data.categories.length > 0 && (
        <div className="res-tabs" role="tablist">
          {data.categories.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === catId}
              className={`chip${c.id === catId ? ' is-on' : ''}`}
              onClick={() => setCatId(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite">
        {loading && <p className="muted">{t('res.loading')}</p>}
        {!loading && !category && <p className="muted">{t('res.none')}</p>}

        {!loading && category && (
          <>
            {podium.length > 0 && (
              <div className="podium">
                {podium.map((e) => (
                  <div key={e.name} className={`pod pod-${e.position}`}>
                    <span className="pos">{e.position}</span>
                    <span className="who">{e.name}</span>
                    <span className="club">{e.club || e.city}</span>
                    <span className="perf">{perf(e)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t('res.pos')}</th>
                    <th>{t('res.skater')}</th>
                    <th>{t('res.bib')}</th>
                    <th className="num">{isTimed ? t('res.time') : t('res.score')}</th>
                    <th className="num">{t('res.points')}</th>
                  </tr>
                </thead>
                <tbody>
                  {category.entries.map((e, i) => (
                    <tr key={`${e.name}-${i}`} className={e.position === 1 ? 'medal-1' : ''}>
                      <td className="rank">{e.outcome === 'finished' ? e.position : '—'}</td>
                      <td className="skater">
                        {e.name}
                        <span className="sub">{[e.club, e.city].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td>{e.bib_number ?? ''}</td>
                      <td className="num">{e.outcome === 'finished' ? perf(e) : <span className="tag">{e.outcome.toUpperCase()}</span>}</td>
                      <td className="num">{e.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="standings">
        <div className="sec-head">
          <h3 className="display h3">{t('res.standings')}</h3>
          <p className="sec-sub">{t('res.note', { year, points: pointsTable.join(', ') })}</p>
        </div>
        <div className="table-scroll">
          <table className="data">
            {standings.length === 0 ? (
              <tbody>
                <tr>
                  <td className="muted">{t('res.standEmpty')}</td>
                </tr>
              </tbody>
            ) : (
              <>
                <thead>
                  <tr>
                    <th>{t('res.rank')}</th>
                    <th>{t('res.skater')}</th>
                    <th className="num">{t('res.events')}</th>
                    <th className="num">{t('res.wins')}</th>
                    <th className="num">{t('res.podiums')}</th>
                    <th className="num">{t('res.points')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.rank} className={r.rank === 1 ? 'medal-1' : ''}>
                      <td className="rank">{r.rank}</td>
                      <td className="skater">
                        {r.name}
                        <span className="sub">{[r.club, r.city].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="num">{r.events}</td>
                      <td className="num">{r.wins}</td>
                      <td className="num">{r.podiums}</td>
                      <td className="num">
                        <strong>{r.points}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </>
            )}
          </table>
        </div>
        {standings.length > 10 && (
          <div className="more-row">
            <button type="button" className="link-btn" onClick={() => setShowAll((v) => !v)}>
              {showAll ? t('res.showTop') : t('res.showAll', { n: standings.length })}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
