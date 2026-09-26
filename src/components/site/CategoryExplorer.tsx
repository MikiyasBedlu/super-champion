'use client';

import { useMemo, useState } from 'react';
import { translator, type Lang } from '@/lib/dictionaries';
import { ageOn, categoryMayFit } from '@/lib/domain';
import type { PublicEvent } from '@/lib/queries';
import type { PublicCategory } from '@/lib/domain';

export const feeLabel = (lang: Lang, fee: number): string => {
  const t = translator(lang);
  return fee ? t('fee.birr', { n: fee.toLocaleString('en-US') }) : t('fee.free');
};

export default function CategoryExplorer({ lang, event }: { lang: Lang; event: PublicEvent | null }) {
  const t = translator(lang);
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [discipline, setDiscipline] = useState<'all' | 'speed' | 'freestyle'>('all');

  const categories: PublicCategory[] = event?.categories ?? [];
  const age = dob && event ? ageOn(dob, event.starts_on) : null;

  const shown = useMemo(
    () => categories.filter((c) => discipline === 'all' || c.discipline === discipline),
    [categories, discipline],
  );
  const fitCount = age === null ? 0 : shown.filter((c) => categoryMayFit(c, age, gender)).length;

  const message =
    age === null
      ? ''
      : age < 3 || age > 99
        ? t('cats.checkDob')
        : fitCount === 0
          ? t('cats.noFit', { age })
          : (fitCount === 1 ? t('cats.fit1', { age }) : t('cats.fit', { age, n: fitCount })) + (gender ? '' : t('cats.fitPickGender'));

  return (
    <>
      <p className="sec-sub">{event ? t('cats.subEvent', { event: event.name }) : t('cats.sub')}</p>

      <form className="finder" onSubmit={(e) => e.preventDefault()}>
        <label>
          <span className="lbl">{t('cats.dob')}</span>
          <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </label>
        <fieldset className="seg">
          <legend>{t('cats.skater')}</legend>
          <label>
            <input type="radio" name="finder-gender" value="female" checked={gender === 'female'} onChange={() => setGender('female')} />
            <span>{t('cats.female')}</span>
          </label>
          <label>
            <input type="radio" name="finder-gender" value="male" checked={gender === 'male'} onChange={() => setGender('male')} />
            <span>{t('cats.male')}</span>
          </label>
        </fieldset>
        <p className="finder-out" aria-live="polite">
          {message}
        </p>
      </form>

      <div className="disc-filter" role="group">
        {(['all', 'speed', 'freestyle'] as const).map((d) => (
          <button
            key={d}
            type="button"
            className={`chip${discipline === d ? ' is-on' : ''}`}
            aria-pressed={discipline === d}
            onClick={() => setDiscipline(d)}
          >
            {t(`cats.${d}`)}
          </button>
        ))}
      </div>

      <div className="table-scroll">
        <table className="cat-table">
          <thead>
            <tr>
              <th scope="col">{t('cats.thCategory')}</th>
              <th scope="col">{t('cats.thAges')}</th>
              <th scope="col">{t('cats.thDistance')}</th>
              <th scope="col">{t('cats.thFee')}</th>
              <th scope="col">{t('cats.thPlaces')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  {t('cats.none')}
                </td>
              </tr>
            )}
            {shown.map((c) => {
              const fits = age !== null && categoryMayFit(c, age, gender);
              const pct = c.capacity ? Math.min(100, Math.round((c.taken / c.capacity) * 100)) : 0;
              const low = c.spots_left !== null && c.capacity !== null && c.spots_left <= Math.max(3, c.capacity * 0.15);
              return (
                <tr key={c.id} className={age === null ? '' : fits ? 'fits' : 'dim'}>
                  <td>
                    {c.name}
                    <span className="disc">{`${t(`disc.${c.discipline}`)} · ${t(`gender.${c.gender}`)}`}</span>
                  </td>
                  <td>{c.max_age >= 90 ? `${c.min_age}+` : `${c.min_age}–${c.max_age}`}</td>
                  <td>{c.distance || '—'}</td>
                  <td>{feeLabel(lang, c.fee_birr)}</td>
                  <td>
                    {c.capacity === null ? (
                      t('cats.openPlaces')
                    ) : (
                      <div className={`places${low ? ' low' : ''}`} ref={(el) => el?.style.setProperty('--fill', `${pct}%`)}>
                        <i />
                        <span>{c.spots_left === 0 ? t('cats.full') : t('cats.left', { n: c.spots_left ?? 0 })}</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="fine">{t('cats.fine')}</p>
    </>
  );
}
