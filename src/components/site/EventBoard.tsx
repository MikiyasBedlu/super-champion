'use client';

import { useEffect, useState } from 'react';
import { translator, type Lang } from '@/lib/dictionaries';
import { formatDate } from '@/lib/domain';
import type { PublicEvent, SiteSummary } from '@/lib/queries';

const pad = (n: number) => String(n).padStart(2, '0');

function useCountdown(startsOn: string | undefined) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!startsOn) return;
    // Races start at 8 in the morning, Addis Ababa time.
    const target = new Date(`${startsOn}T08:00:00+03:00`).getTime();
    const tick = () => setLeft(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startsOn]);
  if (left === null) return null;
  return {
    d: Math.floor(left / 864e5),
    h: Math.floor((left % 864e5) / 36e5),
    m: Math.floor((left % 36e5) / 6e4),
    s: Math.floor((left % 6e4) / 1e3),
  };
}

export default function EventBoard({ lang, event, totals }: { lang: Lang; event: PublicEvent | null; totals: SiteSummary['totals'] }) {
  const t = translator(lang);
  const time = useCountdown(event?.starts_on);

  if (!event) {
    return (
      <aside className="board">
        <h2>{t('board.none')}</h2>
        <p className="where">{t('board.noneSub')}</p>
      </aside>
    );
  }

  const state =
    event.registration === 'open'
      ? t('board.open', { date: formatDate(event.registration_closes_on, lang, 'dayMonth') })
      : event.registration === 'not_yet_open'
        ? t('board.notYet', { date: formatDate(event.registration_opens_on, lang, 'dayMonth') })
        : event.registration === 'completed'
          ? t('board.completed')
          : t('board.closed');

  const dates =
    event.starts_on === event.ends_on
      ? formatDate(event.starts_on, lang)
      : `${formatDate(event.starts_on, lang, 'dayMonth')} – ${formatDate(event.ends_on, lang)}`;

  return (
    <aside className="board" aria-live="polite">
      <h2>{event.name}</h2>
      <p className="where">{`${dates} · ${[event.venue, event.city].filter(Boolean).join(', ')}`}</p>

      <div className="count" role="timer">
        <div>
          <b>{time ? time.d : '–'}</b>
          <span>{t('board.days')}</span>
        </div>
        <div>
          <b>{time ? pad(time.h) : '–'}</b>
          <span>{t('board.hours')}</span>
        </div>
        <div>
          <b>{time ? pad(time.m) : '–'}</b>
          <span>{t('board.min')}</span>
        </div>
        <div>
          <b>{time ? pad(time.s) : '–'}</b>
          <span>{t('board.sec')}</span>
        </div>
      </div>

      <p className="board-facts">
        <span>
          <strong>{event.skaters}</strong> {t('board.skaters')}
        </span>
        <span>
          <strong>{event.categories?.length ?? 0}</strong> {t('board.categories')}
        </span>
        {totals.cities > 0 && (
          <span>
            <strong>{totals.cities}</strong> {t('board.cities')}
          </span>
        )}
      </p>

      <span className={`reg-state${event.registration === 'open' ? '' : ' closed'}`}>{state}</span>
    </aside>
  );
}
