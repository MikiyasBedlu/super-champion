import { notFound } from 'next/navigation';
import { isLang, translator, type Lang } from '@/lib/dictionaries';
import { getEventResults, getNews, getPublicEvents, getSiteSummary, getStandings } from '@/lib/queries';
import Nav from '@/components/site/Nav';
import EventBoard from '@/components/site/EventBoard';
import CategoryExplorer from '@/components/site/CategoryExplorer';
import RegisterWizard from '@/components/site/RegisterWizard';
import ResultsPanel from '@/components/site/ResultsPanel';
import NewsList from '@/components/site/NewsList';
import ContactForm from '@/components/site/ContactForm';

export const dynamic = 'force-dynamic';

const GEAR = [
  ['medal', 'gear.medal'], ['race-jersey', 'gear.jersey'], ['speed-skate', 'gear.skate'], ['accreditation', 'gear.pass'],
  ['venue-sign', 'gear.sign'], ['mural', 'gear.mural'], ['tshirt', 'gear.tshirt'], ['jacket', 'gear.jacket'],
  ['cap', 'gear.cap'], ['kit-bag', 'gear.bag'], ['bottle', 'gear.bottle'], ['business-cards', 'gear.cards'],
  ['phone-case', 'gear.phone'], ['flag', 'gear.flag'], ['team-van', 'gear.van'],
] as const;

const PALETTE = [
  ['sw-teal', '#024151', 'mark.c1', 'mark.c1d'],
  ['sw-flame', '#FE5234', 'mark.c2', 'mark.c2d'],
  ['sw-gold', '#E8A33D', 'mark.c3', 'mark.c3d'],
  ['sw-rink', '#EDF1F2', 'mark.c4', 'mark.c4d'],
] as const;

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: raw } = await params;
  if (!isLang(raw)) notFound();
  const lang = raw as Lang;
  const t = translator(lang);

  // Everything the page needs is read on the server, in parallel.
  const [site, events, news, standings] = await Promise.all([getSiteSummary(), getPublicEvents(), getNews(), getStandings()]);
  const firstWithResults = events.find((e) => e.has_results);
  const results = firstWithResults ? await getEventResults(firstWithResults.slug) : null;

  return (
    <>
      <a className="skip" href="#main">
        {t('nav.skip')}
      </a>
      <Nav lang={lang} />

      <main id="main">
        {/* Hero — the loop is drawn once on load, like a skater tracing the track */}
        <section className="hero">
          <svg className="track" viewBox="0 0 1200 520" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
            <defs>
              <path
                id="loop"
                d="M600 260 C 720 120, 930 80, 1030 160 C 1130 240, 1090 380, 960 400 C 830 420, 720 330, 600 260 C 480 190, 370 100, 240 120 C 110 140, 70 280, 170 360 C 270 440, 480 400, 600 260 Z"
              />
            </defs>
            <use href="#loop" className="lane lane-outer" />
            <use href="#loop" className="lane lane-mid" />
            <use href="#loop" className="lane-draw" />
          </svg>
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <h1 className="display" dangerouslySetInnerHTML={{ __html: t('hero.title') }} />
              <p className="hero-lede">{t('hero.lede')}</p>
              <div className="hero-actions">
                <a className="btn btn-flame" href="#register">
                  {t('hero.cta1')}
                </a>
                <a className="btn btn-ghost" href="#categories">
                  {t('hero.cta2')}
                </a>
              </div>
            </div>
            <EventBoard lang={lang} event={site.next_event} totals={site.totals} />
          </div>
        </section>

        {/* The name */}
        <section className="section name" id="name">
          <div className="wrap name-grid">
            <div>
              <h2 className="display name-eq">
                <span>{t('name.eq1')}</span>
                <span>{t('name.eq2')}</span>
              </h2>
              <p className="name-sum">{t('name.sum')}</p>
            </div>
            <div className="name-body">
              <p dangerouslySetInnerHTML={{ __html: t('name.p1') }} />
              <h3>{t('name.why')}</h3>
              <dl className="reasons">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i}>
                    <dt>{t(`name.r${i}t`)}</dt>
                    <dd>{t(`name.r${i}d`)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* The mark */}
        <section className="section mark" id="mark">
          <div className="wrap">
            <div className="sec-head">
              <h2 className="display">{t('mark.title')}</h2>
              <p className="sec-sub">{t('mark.sub')}</p>
            </div>

            <div className="mark-grid">
              {[
                ['light', '/assets/img/logo.png', 'mark.v1t', 'mark.v1d'],
                ['dark', '/assets/img/logo-knockout.png', 'mark.v2t', 'mark.v2d'],
                ['flame', '/assets/img/logo-white.png', 'mark.v3t', 'mark.v3d'],
              ].map(([tone, src, title, note]) => (
                <figure className={`mark-show ${tone}`} key={tone}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt={t(title)} />
                  <figcaption>
                    <b>{t(title)}</b>
                    <span>{t(note)}</span>
                  </figcaption>
                </figure>
              ))}
            </div>

            <div className="anatomy">
              <figure className="anatomy-mark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/img/mark.png" alt={t('mark.a1t')} />
              </figure>
              <ol className="anatomy-list">
                {[1, 2, 3, 4].map((i) => (
                  <li key={i}>
                    <b>{t(`mark.a${i}t`)}</b>
                    <span>{t(`mark.a${i}d`)}</span>
                  </li>
                ))}
              </ol>
            </div>

            <h3 className="pal-title">{t('mark.colours')}</h3>
            <ul className="palette">
              {PALETTE.map(([cls, hex, name, note]) => (
                <li key={cls}>
                  <i className={cls} />
                  <b>{t(name)}</b>
                  <code>{hex}</code>
                  <span>{t(note)}</span>
                </li>
              ))}
            </ul>
            <p className="fine">{t('mark.note')}</p>
          </div>
        </section>

        {/* Categories */}
        <section className="section cats" id="categories">
          <div className="wrap">
            <div className="sec-head">
              <h2 className="display">{t('cats.title')}</h2>
            </div>
            <CategoryExplorer lang={lang} event={site.next_event} />
          </div>
        </section>

        {/* Registration */}
        <section className="section register" id="register">
          <div className="wrap">
            <RegisterWizard lang={lang} event={site.next_event} />
          </div>
        </section>

        {/* Results */}
        <section className="section results" id="results">
          <div className="wrap">
            <ResultsPanel
              lang={lang}
              events={events}
              initialResults={results ? { categories: results.categories } : null}
              standings={standings.standings}
              pointsTable={standings.points_table}
              year={standings.year}
            />
          </div>
        </section>

        {/* News */}
        <section className="section news" id="news">
          <div className="wrap">
            <div className="sec-head">
              <h2 className="display">{t('news.title')}</h2>
            </div>
            <NewsList lang={lang} news={news} />
          </div>
        </section>

        {/* Race-day look */}
        <section className="section gear">
          <div className="wrap">
            <div className="sec-head">
              <h2 className="display">{t('gear.title')}</h2>
              <p className="sec-sub">{t('gear.sub')}</p>
            </div>
          </div>
          <div className="gear-strip" tabIndex={0} role="region" aria-label={t('gear.title')}>
            {GEAR.map(([file, key]) => (
              <figure key={file}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/assets/img/gear/${file}.jpg`} alt={t(key)} loading="lazy" />
                <figcaption>{t(key)}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        {/* Questions */}
        <section className="section faq" id="faq">
          <div className="wrap faq-grid">
            <h2 className="display">{t('faq.title')}</h2>
            <div className="faq-list">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <details key={i}>
                  <summary>{t(`faq.q${i}`)}</summary>
                  <p>{t(`faq.a${i}`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="section contact" id="contact">
          <div className="wrap contact-grid">
            <div>
              <h2 className="display">{t('contact.title')}</h2>
              <p>{t('contact.intro')}</p>
              <ul className="contact-direct">
                <li>
                  <span>{t('contact.phone')}</span>
                  <a href="tel:+251909504010">0909 504 010</a>
                </li>
                <li>
                  <span>{t('contact.email')}</span>
                  <a href="mailto:mikiyasbedlu3@gmail.com">mikiyasbedlu3@gmail.com</a>
                </li>
                <li>
                  <span>{t('contact.org')}</span>
                  <b>Super Skate</b>
                </li>
              </ul>
            </div>
            <ContactForm lang={lang} />
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot-row">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/img/logo-knockout.png" alt="Super Champion" width={180} height={121} loading="lazy" />
          <div className="foot-meta">
            <p>{t('foot.org')}</p>
            <p>
              {`© ${new Date().getFullYear()} Super Champion. `}
              <a href="/admin">{t('foot.admin')}</a>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
