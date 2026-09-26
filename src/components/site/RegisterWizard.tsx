'use client';

import { useState } from 'react';
import { translator, type Lang } from '@/lib/dictionaries';
import { ageOn, categoryMayFit, formatDate } from '@/lib/domain';
import { apiFetch, ApiError } from '@/lib/client';
import type { PublicEvent } from '@/lib/queries';
import { feeLabel } from './CategoryExplorer';
import StatusLookup from './StatusLookup';

type Values = {
  first_name: string; last_name: string; date_of_birth: string; gender: string; city: string; club: string;
  category_id: string; phone: string; email: string; guardian_name: string; guardian_phone: string;
  tshirt_size: string; notes: string; consent: boolean; website: string;
};

const EMPTY: Values = {
  first_name: '', last_name: '', date_of_birth: '', gender: '', city: '', club: '', category_id: '',
  phone: '', email: '', guardian_name: '', guardian_phone: '', tshirt_size: '', notes: '', consent: false, website: '',
};

type Done = {
  ref_code: string;
  skater: string;
  event: { name: string };
  category: { name: string; fee_birr: number };
};

const FIELD_STEP: Record<string, number> = {
  first_name: 1, last_name: 1, date_of_birth: 1, gender: 1, city: 1, club: 1, category_id: 2,
  phone: 3, email: 3, guardian_name: 3, guardian_phone: 3, tshirt_size: 3, notes: 3, consent: 4,
};

const phoneOk = (s: string) => /^(?:\+?251|0)?[79]\d{8}$/.test(s.replace(/[\s\-().]/g, ''));

const SIZES = [
  ['YS', 'Youth S'], ['YM', 'Youth M'], ['YL', 'Youth L'],
  ['S', 'S'], ['M', 'M'], ['L', 'L'], ['XL', 'XL'], ['XXL', 'XXL'],
] as const;

export default function RegisterWizard({ lang, event }: { lang: Lang; event: PublicEvent | null }) {
  const t = translator(lang);
  const [step, setStep] = useState(1);
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof Values>(key: K, value: Values[K]) => setV((old) => ({ ...old, [key]: value }));
  const age = v.date_of_birth && event ? ageOn(v.date_of_birth, event.starts_on) : null;
  const eligible = (event?.categories ?? []).filter((c) => age !== null && categoryMayFit(c, age, v.gender));
  const chosen = (event?.categories ?? []).find((c) => String(c.id) === v.category_id);

  function validate(n: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (n === 1) {
      if (!v.first_name.trim()) e.first_name = t('err.first');
      if (!v.last_name.trim()) e.last_name = t('err.last');
      if (!v.date_of_birth) e.date_of_birth = t('err.dob');
      else if (age === null || age < 3 || age > 90) e.date_of_birth = t('err.dobCheck');
      if (!v.gender) e.gender = t('err.gender');
      if (v.city.trim().length < 2) e.city = t('err.city');
    }
    if (n === 2 && !v.category_id) e.category_id = t('err.category');
    if (n === 3) {
      if (!phoneOk(v.phone)) e.phone = t('err.phone');
      if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.email)) e.email = t('err.email');
      if (age !== null && age < 18) {
        if (!v.guardian_name.trim()) e.guardian_name = t('err.gname');
        if (!phoneOk(v.guardian_phone)) e.guardian_phone = t('err.gphone');
      }
    }
    if (n === 4 && !v.consent) e.consent = t('err.consent');
    return e;
  }

  function next() {
    setAlert('');
    if (!event || event.registration !== 'open') {
      setAlert(event ? t('err.notOpen') : t('err.noEvent'));
      return;
    }
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) return;
    // With a single eligible category, pick it so the skater does not have to.
    if (step === 1 && eligible.length === 1 && eligible[0].spots_left !== 0) set('category_id', String(eligible[0].id));
    setStep(step + 1);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setAlert('');
    for (let s = 1; s <= 4; s++) {
      const e = validate(s);
      if (Object.keys(e).length) {
        setStep(s);
        setErrors(e);
        return;
      }
    }
    if (!event) return;
    setBusy(true);
    try {
      const payload = {
        ...v,
        event_slug: event.slug,
        category_id: Number(v.category_id),
        guardian_name: age !== null && age < 18 ? v.guardian_name : '',
        guardian_phone: age !== null && age < 18 ? v.guardian_phone : '',
      };
      const r = await apiFetch<Done>('/api/registrations', { method: 'POST', body: payload, networkMessage: t('err.network') });
      setDone(r);
      setErrors({});
    } catch (err) {
      const e = err as ApiError;
      setErrors(e.fields ?? {});
      const first = Object.keys(e.fields ?? {})[0];
      if (first) setStep(FIELD_STEP[first] ?? 4);
      setAlert(e.message);
    } finally {
      setBusy(false);
    }
  }

  const err = (name: string) => (errors[name] ? <span className="err">{errors[name]}</span> : null);
  const cls = (name: string) => (errors[name] ? 'has-error' : undefined);


  const intro = (
    <div className="reg-intro">
      <h2 className="display">{t('reg.title')}</h2>
      <p>{t('reg.intro')}</p>
      <ol className="steps">
        {['reg.s1', 'reg.s2', 'reg.s3', 'reg.s4'].map((key, i) => (
          <li key={key} className={i + 1 === step ? 'is-on' : i + 1 < step ? 'is-done' : ''}>
            <span>{i + 1}</span>
            <em>{t(key)}</em>
          </li>
        ))}
      </ol>
      <StatusLookup lang={lang} />
    </div>
  );

  if (done) {
    return (
      <div className="reg-grid">
        {intro}
        <div className="reg-card">
        <div className="reg-done">
          <h3>{t('done.title')}</h3>
          <p>{t('done.line', { skater: done.skater, category: done.category.name, event: done.event.name })}</p>
          <div className="ref-box">
            <code>{done.ref_code}</code>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(done.ref_code);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? t('done.copied') : t('done.copy')}
            </button>
          </div>
          <ol className="next-steps">
            <li>{t('done.n1')}</li>
            <li>{t('done.n2', { fee: feeLabel(lang, done.category.fee_birr) })}</li>
            <li>{t('done.n3')}</li>
          </ol>
          <button
            type="button"
            className="btn btn-line"
            onClick={() => {
              setDone(null);
              setV(EMPTY);
              setStep(1);
              setCopied(false);
            }}
          >
            {t('done.another')}
          </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reg-grid">
      {intro}
      <div className="reg-card">
        <form onSubmit={submit} noValidate>
        {alert && (
          <div className="form-alert" role="alert">
            {alert}
          </div>
        )}

        {step === 1 && (
          <fieldset className="step">
            <legend className="step-title">{t('reg.t1')}</legend>
            <div className="grid-2">
              <label className={cls('first_name')}>
                <span className="lbl">{t('reg.first')}</span>
                <input value={v.first_name} maxLength={60} autoComplete="given-name" onChange={(e) => set('first_name', e.target.value)} />
                {err('first_name')}
              </label>
              <label className={cls('last_name')}>
                <span className="lbl">{t('reg.last')}</span>
                <input value={v.last_name} maxLength={60} autoComplete="family-name" onChange={(e) => set('last_name', e.target.value)} />
                {err('last_name')}
              </label>
              <label className={cls('date_of_birth')}>
                <span className="lbl">{t('reg.dob')}</span>
                <input type="date" value={v.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />
                {err('date_of_birth')}
              </label>
              <fieldset className={`seg ${cls('gender') ?? ''}`}>
                <legend>{t('reg.gender')}</legend>
                <label>
                  <input type="radio" name="gender" checked={v.gender === 'female'} onChange={() => set('gender', 'female')} />
                  <span>{t('reg.f')}</span>
                </label>
                <label>
                  <input type="radio" name="gender" checked={v.gender === 'male'} onChange={() => set('gender', 'male')} />
                  <span>{t('reg.m')}</span>
                </label>
                {err('gender')}
              </fieldset>
              <label className={cls('city')}>
                <span className="lbl">{t('reg.city')}</span>
                <input value={v.city} maxLength={60} autoComplete="address-level2" onChange={(e) => set('city', e.target.value)} />
                {err('city')}
              </label>
              <label>
                <span className="lbl" dangerouslySetInnerHTML={{ __html: t('reg.club') }} />
                <input value={v.club} maxLength={80} onChange={(e) => set('club', e.target.value)} />
              </label>
            </div>
          </fieldset>
        )}

        {step === 2 && (
          <fieldset className="step">
            <legend className="step-title">{t('reg.t2')}</legend>
            <p className="step-note">
              {eligible.length
                ? t('reg.catNote', { age: age ?? 0, who: v.gender === 'female' ? t('reg.whoF') : t('reg.whoM') })
                : t('reg.catNone', { age: age ?? 0, who: v.gender === 'female' ? t('reg.whoF') : t('reg.whoM') })}
            </p>
            <div className={`cat-options ${cls('category_id') ?? ''}`}>
              {eligible.map((c) => (
                <label className="cat-opt" key={c.id}>
                  <input
                    type="radio"
                    name="category_id"
                    value={c.id}
                    disabled={c.spots_left === 0}
                    checked={v.category_id === String(c.id)}
                    onChange={() => set('category_id', String(c.id))}
                  />
                  <span>
                    <b>{c.name}</b>
                    <small>
                      {c.distance || t(`disc.${c.discipline}`)}
                      {c.spots_left !== null ? ` · ${c.spots_left === 0 ? t('reg.full') : t('reg.places', { n: c.spots_left })}` : ''}
                    </small>
                    <em className="fee">{feeLabel(lang, c.fee_birr)}</em>
                  </span>
                </label>
              ))}
              {err('category_id')}
            </div>
          </fieldset>
        )}

        {step === 3 && (
          <fieldset className="step">
            <legend className="step-title">{t('reg.t3')}</legend>
            <div className="grid-2">
              <label className={cls('phone')}>
                <span className="lbl">{t('reg.phone')}</span>
                <input type="tel" inputMode="tel" value={v.phone} placeholder="0911 234 567" onChange={(e) => set('phone', e.target.value)} />
                {err('phone')}
              </label>
              <label className={cls('email')}>
                <span className="lbl" dangerouslySetInnerHTML={{ __html: t('reg.email') }} />
                <input type="email" value={v.email} onChange={(e) => set('email', e.target.value)} />
                {err('email')}
              </label>
            </div>

            {age !== null && age < 18 && (
              <div className="guardian">
                <p className="step-note">{t('reg.guardNote')}</p>
                <div className="grid-2">
                  <label className={cls('guardian_name')}>
                    <span className="lbl">{t('reg.gname')}</span>
                    <input value={v.guardian_name} maxLength={80} onChange={(e) => set('guardian_name', e.target.value)} />
                    {err('guardian_name')}
                  </label>
                  <label className={cls('guardian_phone')}>
                    <span className="lbl">{t('reg.gphone')}</span>
                    <input type="tel" inputMode="tel" value={v.guardian_phone} placeholder="0911 234 567" onChange={(e) => set('guardian_phone', e.target.value)} />
                    {err('guardian_phone')}
                  </label>
                </div>
              </div>
            )}

            <div className="grid-2">
              <label>
                <span className="lbl" dangerouslySetInnerHTML={{ __html: t('reg.tshirt') }} />
                <select value={v.tshirt_size} onChange={(e) => set('tshirt_size', e.target.value)}>
                  <option value="">{t('reg.chooseSize')}</option>
                  {SIZES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="lbl" dangerouslySetInnerHTML={{ __html: t('reg.notes') }} />
                <textarea rows={2} maxLength={500} value={v.notes} onChange={(e) => set('notes', e.target.value)} />
              </label>
            </div>

            <label className="hp" aria-hidden="true">
              Website
              <input tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set('website', e.target.value)} />
            </label>
          </fieldset>
        )}

        {step === 4 && (
          <fieldset className="step">
            <legend className="step-title">{t('reg.t4')}</legend>
            <dl className="review">
              <dt>{t('rev.skater')}</dt>
              <dd>{`${v.first_name} ${v.last_name}`}</dd>
              <dt>{t('rev.dob')}</dt>
              <dd>{t('rev.dobVal', { date: formatDate(v.date_of_birth, lang), age: age ?? 0 })}</dd>
              <dt>{t('rev.city')}</dt>
              <dd>{[v.city, v.club].filter(Boolean).join(' · ')}</dd>
              <dt>{t('rev.category')}</dt>
              <dd>{chosen?.name ?? ''}</dd>
              <dt>{t('rev.fee')}</dt>
              <dd>{chosen ? feeLabel(lang, chosen.fee_birr) : ''}</dd>
              <dt>{t('rev.phone')}</dt>
              <dd>{v.phone}</dd>
              {v.email && (
                <>
                  <dt>{t('rev.email')}</dt>
                  <dd>{v.email}</dd>
                </>
              )}
              {age !== null && age < 18 && (
                <>
                  <dt>{t('rev.guardian')}</dt>
                  <dd>{`${v.guardian_name} · ${v.guardian_phone}`}</dd>
                </>
              )}
            </dl>
            <label className={`check ${cls('consent') ?? ''}`}>
              <input type="checkbox" checked={v.consent} onChange={(e) => set('consent', e.target.checked)} />
              <span>{t('reg.consent')}</span>
              {err('consent')}
            </label>
          </fieldset>
        )}

        <div className="step-nav">
          {step > 1 && (
            <button type="button" className="btn btn-line" onClick={() => setStep(step - 1)}>
              {t('reg.back')}
            </button>
          )}
          {step < 4 ? (
            <button type="button" className="btn btn-flame" onClick={next} style={step === 1 ? { marginLeft: 'auto' } : undefined}>
              {t('reg.next')}
            </button>
          ) : (
            <button type="submit" className="btn btn-flame" disabled={busy}>
              {busy ? t('reg.sending') : t('reg.send')}
            </button>
          )}
        </div>
        </form>
      </div>
    </div>
  );
}
