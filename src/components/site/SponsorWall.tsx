'use client';

import { useEffect, useRef } from 'react';
import { translator, type Lang } from '@/lib/dictionaries';
import type { Sponsor } from '@/lib/queries';

/* Video plays muted and looping, like a billboard: it must never interrupt the page.
   It is paused while off screen so a phone on mobile data is not asked to decode it. */
function SponsorVideo({ sponsor }: { sponsor: Sponsor }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      muted
      loop
      playsInline
      preload="none"
      poster={sponsor.poster_url || undefined}
      aria-label={sponsor.name}
    >
      <source src={sponsor.media_url} />
    </video>
  );
}

function Media({ sponsor }: { sponsor: Sponsor }) {
  if (sponsor.media_kind === 'video') return <SponsorVideo sponsor={sponsor} />;
  // Animated GIF and animated WebP arrive here too — the browser plays them on its own.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={sponsor.media_url} alt={sponsor.name} loading="lazy" />;
}

export default function SponsorWall({ lang, sponsors }: { lang: Lang; sponsors: Sponsor[] }) {
  const t = translator(lang);
  if (!sponsors.length) return null;

  const headline = sponsors.filter((s) => s.tier === 'headline');
  const rest = sponsors.filter((s) => s.tier !== 'headline');

  /* A plain function, not a nested component, so React keeps the <video> element
     between renders instead of tearing it down and starting the clip again. */
  function card(s: Sponsor, big = false) {
    const inner = (
      <>
        <div className="sponsor-media">
          <Media sponsor={s} />
        </div>
        <figcaption>
          <b>{s.name}</b>
          {s.caption ? <span>{s.caption}</span> : null}
        </figcaption>
      </>
    );
    const className = `sponsor sponsor-${s.tier}${big ? ' is-big' : ''}`;
    return s.link_url ? (
      <a key={s.id} className={className} href={s.link_url} target="_blank" rel="noopener noreferrer sponsored">
        {inner}
      </a>
    ) : (
      <figure key={s.id} className={className}>
        {inner}
      </figure>
    );
  }

  return (
    <section className="section sponsors" id="sponsors" aria-labelledby="sponsors-title">
      <div className="wrap">
        <div className="sec-head">
          <h2 id="sponsors-title" className="display">
            {t('sponsors.title')}
          </h2>
          <p className="sec-sub">{t('sponsors.sub')}</p>
        </div>

        {headline.length > 0 && (
          <div className="sponsor-headline">
            {headline.map((s) => card(s, true))}
          </div>
        )}

        {rest.length > 0 && (
          <div className="sponsor-grid">
            {rest.map((s) => card(s))}
          </div>
        )}

        <p className="fine sponsor-cta">
          {t('sponsors.cta')} <a href="#contact">{t('sponsors.ctaLink')}</a>
        </p>
      </div>
    </section>
  );
}
