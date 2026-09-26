'use client';

import { useState } from 'react';
import { translator, type Lang } from '@/lib/dictionaries';
import { formatDate } from '@/lib/domain';
import { apiFetch, ApiError } from '@/lib/client';

type Status = {
  ref_code: string;
  skater: string;
  status: 'pending' | 'approved' | 'checked_in' | 'rejected' | 'withdrawn';
  bib_number: number | null;
  event: { name: string; starts_on: string };
  category: { name: string };
};

export default function StatusLookup({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const [ref, setRef] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Status | null>(null);
  const [error, setError] = useState('');

  async function check(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    setError('');
    const code = ref.trim().toUpperCase();
    if (!/^SC-[A-Z0-9]{6}$/.test(code) || !/^(?:\+?251|0)?[79]\d{8}$/.test(phone.replace(/[\s\-().]/g, ''))) {
      setError(t('look.bad'));
      return;
    }
    setBusy(true);
    try {
      setResult(
        await apiFetch<Status>(`/api/registrations/status?ref=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`, {
          networkMessage: t('err.network'),
        }),
      );
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="lookup" onSubmit={check} noValidate>
      <h3>{t('look.title')}</h3>
      <label>
        <span className="lbl">{t('look.ref')}</span>
        <input value={ref} placeholder="SC-7KQ4XM" autoComplete="off" spellCheck={false} onChange={(e) => setRef(e.target.value)} />
      </label>
      <label>
        <span className="lbl">{t('look.phone')}</span>
        <input type="tel" inputMode="tel" value={phone} placeholder="0911 234 567" onChange={(e) => setPhone(e.target.value)} />
      </label>
      <button className="btn btn-line" type="submit" disabled={busy}>
        {t('look.btn')}
      </button>

      <div className="lookup-out" aria-live="polite">
        {error && (
          <div className="status-card">
            <p className="lookup-err">{error}</p>
          </div>
        )}
        {result && (
          <div className="status-card">
            <span className={`st st-${result.status}`}>{t(`look.${result.status}`)}</span>
            <p>
              <strong>{result.skater}</strong>
              {` · ${result.category.name}`}
            </p>
            <p>{`${result.event.name} · ${formatDate(result.event.starts_on, lang)}`}</p>
            <p>{result.bib_number ? t('look.bib', { n: result.bib_number }) : t('look.noBib')}</p>
          </div>
        )}
      </div>
    </form>
  );
}
