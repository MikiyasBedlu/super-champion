'use client';

import { useState } from 'react';
import { translator, type Lang } from '@/lib/dictionaries';
import { apiFetch, ApiError } from '@/lib/client';

const TOPICS = [
  ['general', 'contact.t1'],
  ['registration', 'contact.t2'],
  ['sponsorship', 'contact.t3'],
  ['media', 'contact.t4'],
  ['volunteering', 'contact.t5'],
] as const;

export default function ContactForm({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const [v, setV] = useState({ name: '', topic: 'general', email: '', phone: '', body: '', website: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<{ text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof v, value: string) => setV((old) => ({ ...old, [key]: value }));
  const err = (name: string) => (errors[name] ? <span className="err">{errors[name]}</span> : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setAlert(null);
    const next: Record<string, string> = {};
    if (v.name.trim().length < 2) next.name = t('err.name');
    if (!v.email && !v.phone) next.email = t('err.contactWay');
    if (v.phone && !/^(?:\+?251|0)?[79]\d{8}$/.test(v.phone.replace(/[\s\-().]/g, ''))) next.phone = t('err.phone');
    if (v.body.trim().length < 10) next.body = t('err.body');
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await apiFetch('/api/contact', { method: 'POST', body: v, networkMessage: t('err.network') });
      setV({ name: '', topic: 'general', email: '', phone: '', body: '', website: '' });
      setAlert({ text: t('contact.ok'), ok: true });
    } catch (e2) {
      const apiErr = e2 as ApiError;
      setErrors(apiErr.fields ?? {});
      setAlert({ text: apiErr.message, ok: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      {alert && (
        <div className={`form-alert${alert.ok ? ' ok' : ''}`} role="alert">
          {alert.text}
        </div>
      )}
      <div className="grid-2">
        <label className={errors.name ? 'has-error' : undefined}>
          <span className="lbl">{t('contact.name')}</span>
          <input value={v.name} maxLength={80} autoComplete="name" onChange={(e) => set('name', e.target.value)} />
          {err('name')}
        </label>
        <label>
          <span className="lbl">{t('contact.topic')}</span>
          <select value={v.topic} onChange={(e) => set('topic', e.target.value)}>
            {TOPICS.map(([value, key]) => (
              <option key={value} value={value}>
                {t(key)}
              </option>
            ))}
          </select>
        </label>
        <label className={errors.email ? 'has-error' : undefined}>
          <span className="lbl">{t('contact.yourEmail')}</span>
          <input type="email" value={v.email} autoComplete="email" onChange={(e) => set('email', e.target.value)} />
          {err('email')}
        </label>
        <label className={errors.phone ? 'has-error' : undefined}>
          <span className="lbl">{t('contact.yourPhone')}</span>
          <input type="tel" inputMode="tel" value={v.phone} autoComplete="tel" onChange={(e) => set('phone', e.target.value)} />
          {err('phone')}
        </label>
      </div>
      <label className={errors.body ? 'has-error' : undefined}>
        <span className="lbl">{t('contact.message')}</span>
        <textarea rows={4} maxLength={2000} value={v.body} onChange={(e) => set('body', e.target.value)} />
        {err('body')}
      </label>
      <label className="hp" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => set('website', e.target.value)} />
      </label>
      <button className="btn btn-flame" type="submit" disabled={busy}>
        {t('contact.send')}
      </button>
    </form>
  );
}
