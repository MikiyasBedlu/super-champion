'use client';

import { useEffect, useRef, useState } from 'react';

export type FieldSpec = {
  name: string;
  label: string;
  type?: 'text' | 'number' | 'date' | 'email' | 'password' | 'select' | 'textarea' | 'checkbox';
  value?: string | number | boolean | null;
  options?: [string | number, string][];
  help?: string;
  full?: boolean;
  rows?: number;
  placeholder?: string;
  min?: number;
};

export type FormValues = Record<string, string | number | boolean | null>;

export function Badge({ value }: { value: string }) {
  return <span className={`badge b-${value}`}>{String(value).replace('_', ' ')}</span>;
}

export function Toast({ message, bad }: { message: string; bad?: boolean }) {
  if (!message) return null;
  return (
    <div className={`toast${bad ? ' bad' : ''}`} role="status">
      {message}
    </div>
  );
}

/** One dialog component for every admin form: fields in, values out. */
export function FormModal({
  title,
  fields,
  submitLabel = 'Save',
  extra,
  onSubmit,
  onClose,
}: {
  title: string;
  fields: FieldSpec[];
  submitLabel?: string;
  extra?: React.ReactNode;
  onSubmit: (values: FormValues) => Promise<void>;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [values, setValues] = useState<FormValues>(() =>
    Object.fromEntries(fields.map((f) => [f.name, f.type === 'checkbox' ? Boolean(f.value) : (f.value ?? '')])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const set = (name: string, value: string | number | boolean | null) => setValues((old) => ({ ...old, [name]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});
    setAlert('');
    setBusy(true);
    try {
      await onSubmit(values);
      onClose();
    } catch (err) {
      const apiErr = err as { message: string; fields?: Record<string, string> };
      setErrors(apiErr.fields ?? {});
      setAlert(apiErr.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog className="dlg" ref={ref} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <h2>{title}</h2>
        {extra}
        {alert && (
          <div className="form-alert" role="alert">
            {alert}
          </div>
        )}
        <div className="fields">
          {fields.map((f) => {
            const error = errors[f.name];
            const cls = `${f.full ? 'full' : ''}${error ? ' has-error' : ''}`.trim();
            if (f.type === 'checkbox') {
              return (
                <label className={`check-row full${error ? ' has-error' : ''}`} key={f.name}>
                  <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(f.name, e.target.checked)} />
                  {f.label}
                </label>
              );
            }
            return (
              <label className={cls || undefined} key={f.name}>
                {f.label}
                {f.help && <span className="help">{f.help}</span>}
                {f.type === 'select' ? (
                  <select value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)}>
                    {(f.options ?? []).map(([value, label]) => (
                      <option key={String(value)} value={String(value)}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea rows={f.rows ?? 4} value={String(values[f.name] ?? '')} onChange={(e) => set(f.name, e.target.value)} />
                ) : (
                  <input
                    type={f.type ?? 'text'}
                    min={f.min}
                    placeholder={f.placeholder}
                    value={String(values[f.name] ?? '')}
                    onChange={(e) => set(f.name, f.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
                  />
                )}
                {error && <span className="err">{error}</span>}
              </label>
            );
          })}
        </div>
        <div className="foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

export function ConfirmModal({
  message,
  okLabel = 'Delete',
  onConfirm,
  onClose,
}: {
  message: string;
  okLabel?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog className="dlg" ref={ref} onClose={onClose}>
      <form method="dialog">
        <h2>Are you sure?</h2>
        <p>{message}</p>
        <div className="foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
          >
            {okLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
