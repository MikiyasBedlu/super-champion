'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translator, type Lang } from '@/lib/dictionaries';

const LINKS = [
  ['#name', 'nav.name'],
  ['#mark', 'nav.mark'],
  ['#categories', 'nav.categories'],
  ['#results', 'nav.results'],
  ['#news', 'nav.news'],
  ['#contact', 'nav.contact'],
] as const;

export default function Nav({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const router = useRouter();
  const [open, setOpen] = useState(false);

  /* The choice is kept in a cookie so "/" lands on the right language next time. */
  const switchTo = (next: Lang) => {
    if (next === lang) return;
    document.cookie = `sc_lang=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.push(`/${next}`);
    router.refresh();
  };

  return (
    <header className="nav" id="top">
      <div className="wrap nav-row">
        <a className="nav-brand" href="#top" aria-label="Super Champion">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/img/mark-knockout.png" alt="" width={64} height={24} />
          <span>Super Champion</span>
        </a>

        <div className="nav-right">
          <div className="lang" role="group" aria-label="Language / ቋንቋ">
            <button type="button" className={lang === 'en' ? 'is-on' : ''} aria-pressed={lang === 'en'} onClick={() => switchTo('en')}>
              EN
            </button>
            <button type="button" className={lang === 'am' ? 'is-on' : ''} aria-pressed={lang === 'am'} onClick={() => switchTo('am')}>
              አማ
            </button>
          </div>
          <button className="nav-toggle" type="button" aria-expanded={open} aria-controls="nav-links" onClick={() => setOpen((v) => !v)}>
            <span className="sr">Menu</span>
            <i />
            <i />
          </button>
        </div>

        <nav id="nav-links" className={`nav-links${open ? ' is-open' : ''}`} aria-label="Main" onClick={() => setOpen(false)}>
          {LINKS.map(([href, key]) => (
            <a key={href} href={href}>
              {t(key)}
            </a>
          ))}
          <a className="btn btn-flame btn-sm" href="#register">
            {t('nav.register')}
          </a>
        </nav>
      </div>
    </header>
  );
}
