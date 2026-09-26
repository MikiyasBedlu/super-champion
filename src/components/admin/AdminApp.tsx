'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/client';
import { formatDate, formatDateTime, formatTime, parseTime } from '@/lib/domain';
import { Badge, ConfirmModal, FormModal, Toast, type FieldSpec, type FormValues } from './ui';

type Admin = { id: number; email: string; name: string; role: 'owner' | 'staff' };
type Category = {
  id: number; name: string; discipline: string; gender: string; min_age: number; max_age: number;
  distance: string; fee_birr: number; capacity: number | null; taken: number; sort_order?: number;
};
type EventRow = {
  id: number; slug: string; name: string; tagline: string; description: string; city: string; venue: string;
  starts_on: string; ends_on: string; registration_opens_on: string; registration_closes_on: string;
  status: string; categories: Category[];
};
type Registration = {
  id: number; ref_code: string; event_id: number; category_id: number; first_name: string; last_name: string;
  date_of_birth: string; gender: string; city: string; club: string; phone: string; email: string;
  guardian_name: string; guardian_phone: string; tshirt_size: string; notes: string; status: string;
  bib_number: number | null; admin_note: string; created_at: string; category_name: string; fee_birr: number;
  event_name: string; starts_on: string; age_on_race_day: number;
};

const VIEWS = ['dashboard', 'registrations', 'events', 'results', 'news', 'messages', 'team'] as const;
type View = (typeof VIEWS)[number];

const localPhone = (p: string) => (p || '').replace(/^\+251/, '0');

export default function AdminApp() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>('dashboard');
  const [events, setEvents] = useState<EventRow[]>([]);
  const [toast, setToast] = useState<{ text: string; bad?: boolean }>({ text: '' });
  const [unread, setUnread] = useState(0);

  const say = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    setTimeout(() => setToast({ text: '' }), 3500);
  }, []);

  const loadEvents = useCallback(async () => {
    const r = await apiFetch<{ events: EventRow[] }>('/api/admin/events');
    setEvents(r.events);
    return r.events;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await apiFetch<{ admin: Admin }>('/api/admin/me');
        setAdmin(me.admin);
        await loadEvents();
      } catch {
        setAdmin(null);
      } finally {
        setReady(true);
      }
    })();
  }, [loadEvents]);

  useEffect(() => {
    const apply = () => {
      const hash = window.location.hash.slice(1) as View;
      setView(VIEWS.includes(hash) ? hash : 'dashboard');
    };
    apply();
    window.addEventListener('hashchange', apply);
    return () => window.removeEventListener('hashchange', apply);
  }, []);

  if (!ready) return <p className="boot">Loading…</p>;
  if (!admin) return <Login onDone={async (a) => { setAdmin(a); await loadEvents(); }} />;

  const shared = { events, reloadEvents: loadEvents, say, admin };

  return (
    <div className="shell">
      <nav className="side" aria-label="Organiser">
        <a className="side-brand" href="/" title="Open the public site">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/img/mark-knockout.png" alt="" />
          Super Champion
        </a>
        {VIEWS.map((v) => (
          <a key={v} className={`nav${view === v ? ' is-on' : ''}`} href={`#${v}`}>
            {v[0].toUpperCase() + v.slice(1)}
            {v === 'messages' && unread > 0 && <span className="count">{unread}</span>}
          </a>
        ))}
        <a
          className="nav mobile-out"
          href="#"
          onClick={async (e) => {
            e.preventDefault();
            await apiFetch('/api/admin/logout', { method: 'POST', body: {} }).catch(() => {});
            setAdmin(null);
          }}
        >
          Sign out
        </a>
        <div className="side-foot">
          <strong>{admin.name}</strong>
          <span>{`${admin.email} · ${admin.role}`}</span>
          <br />
          <button
            type="button"
            onClick={async () => {
              await apiFetch('/api/admin/logout', { method: 'POST', body: {} }).catch(() => {});
              setAdmin(null);
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      <main className="main">
        {view === 'dashboard' && <Dashboard onUnread={setUnread} />}
        {view === 'registrations' && <Registrations {...shared} />}
        {view === 'events' && <Events {...shared} />}
        {view === 'results' && <Results {...shared} />}
        {view === 'news' && <News say={say} />}
        {view === 'messages' && <Messages say={say} onUnread={setUnread} />}
        {view === 'team' && <Team admin={admin} say={say} />}
      </main>

      <Toast message={toast.text} bad={toast.bad} />
    </div>
  );
}

/* ---------------- Login ---------------- */
function Login({ onDone }: { onDone: (admin: Admin) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <div className="login">
      <div className="login-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/img/logo.png" alt="Super Champion" />
        <h1>Organiser sign-in</h1>
        <p>Manage registrations, events, results and news.</p>
        <form
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              const r = await apiFetch<{ admin: Admin }>('/api/admin/login', { method: 'POST', body: { email, password } });
              onDone(r.admin);
            } catch (err) {
              setError((err as ApiError).message);
              setPassword('');
            } finally {
              setBusy(false);
            }
          }}
        >
          {error && (
            <div className="form-alert" role="alert">
              {error}
            </div>
          )}
          <label>
            Email
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <a className="login-back" href="/">
          Back to the public site
        </a>
      </div>
    </div>
  );
}

/* ---------------- Dashboard ---------------- */
type Stats = {
  registrations: Record<string, number>;
  total_registrations: number;
  unread_messages: number;
  events: { id: number; name: string; status: string; starts_on: string; skaters: number }[];
  daily: { day: string; n: number }[];
  recent: { id: number; ref_code: string; first_name: string; last_name: string; status: string; created_at: string; category: string; event: string }[];
};

function Dashboard({ onUnread }: { onUnread: (n: number) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    apiFetch<Stats>('/api/admin/stats').then((s) => {
      setStats(s);
      onUnread(s.unread_messages);
    });
  }, [onUnread]);
  if (!stats) return <p className="muted">Loading…</p>;

  const days = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(Date.now() - (13 - i) * 864e5).toISOString().slice(0, 10);
    return { day, n: stats.daily.find((d) => d.day === day)?.n ?? 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.n));

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="actions">
          <a className="btn btn-primary" href="#registrations">
            Review registrations
          </a>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{stats.total_registrations}</b>
          <span>Registrations in total</span>
        </div>
        <div className="stat hot">
          <b>{stats.registrations.pending ?? 0}</b>
          <span>Waiting for approval</span>
        </div>
        <div className="stat">
          <b>{(stats.registrations.approved ?? 0) + (stats.registrations.checked_in ?? 0)}</b>
          <span>Approved</span>
        </div>
        <div className={`stat${stats.unread_messages ? ' hot' : ''}`}>
          <b>{stats.unread_messages}</b>
          <span>Unread messages</span>
        </div>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2>New registrations, last 14 days</h2>
          <div className="bars" role="img" aria-label={days.map((d) => `${d.day}: ${d.n}`).join(', ')}>
            {days.map((d) => (
              <div key={d.day}>
                <em>{d.n || ''}</em>
                <i ref={(el) => el?.style.setProperty('height', `${(d.n / max) * 100}%`)} />
                <small>{d.day.slice(8)}</small>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <h2>Events</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Skaters</th>
                </tr>
              </thead>
              <tbody>
                {stats.events.map((e) => (
                  <tr key={e.id}>
                    <td className="wrap">{e.name}</td>
                    <td>{formatDate(e.starts_on, 'en')}</td>
                    <td>
                      <Badge value={e.status} />
                    </td>
                    <td className="num">{e.skaters}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section className="panel">
        <h2>Latest registrations</h2>
        {stats.recent.length === 0 ? (
          <p className="empty">No registrations yet.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ref</th>
                  <th>Skater</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((r) => (
                  <tr key={r.id}>
                    <td>{r.ref_code}</td>
                    <td className="wrap">
                      {`${r.first_name} ${r.last_name}`}
                      <span className="sub">{r.event}</span>
                    </td>
                    <td>{r.category}</td>
                    <td>
                      <Badge value={r.status} />
                    </td>
                    <td>{formatDateTime(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

/* ---------------- Registrations ---------------- */
type Shared = { events: EventRow[]; reloadEvents: () => Promise<EventRow[]>; say: (t: string, bad?: boolean) => void; admin: Admin };

function Registrations({ events, say }: Shared) {
  const [eventId, setEventId] = useState(() => String(events.find((e) => e.status === 'open')?.id ?? events[0]?.id ?? ''));
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ total: number; page: number; size: number; registrations: Registration[] } | null>(null);
  const [editing, setEditing] = useState<Registration | null>(null);
  const [bibs, setBibs] = useState(false);

  const query = new URLSearchParams(Object.entries({ event: eventId, status, q, page: String(page), size: '50' }).filter(([, v]) => v));

  const load = useCallback(async () => {
    const r = await apiFetch<{ total: number; page: number; size: number; registrations: Registration[] }>(
      `/api/admin/registrations?${query.toString()}`,
    );
    setData(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, status, q, page]);

  useEffect(() => {
    const id = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(id);
  }, [load, q]);

  async function quick(r: Registration, next: string) {
    try {
      await apiFetch(`/api/admin/registrations/${r.id}`, { method: 'PATCH', body: { status: next } });
      say(`${r.first_name} ${r.last_name}: ${next.replace('_', ' ')}`);
      load();
    } catch (err) {
      say((err as ApiError).message, true);
    }
  }

  const event = events.find((e) => String(e.id) === eventId);
  const pages = data ? Math.ceil(data.total / data.size) : 1;

  return (
    <>
      <div className="page-head">
        <h1>Registrations</h1>
        <div className="actions">
          <button type="button" className="btn" disabled={!eventId} onClick={() => setBibs(true)}>
            Assign bib numbers
          </button>
          <a className="btn" download href={`/api/admin/registrations/export?${new URLSearchParams({ event: eventId, status, q }).toString()}`}>
            Export CSV
          </a>
        </div>
      </div>

      <div className="filters">
        <label>
          Event
          <select
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All events</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Any status</option>
            {['pending', 'approved', 'checked_in', 'rejected', 'withdrawn'].map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="grow">
          Search
          <input
            type="search"
            placeholder="Name, reference, phone, club or bib"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {!data || data.registrations.length === 0 ? (
        <div className="panel empty">No registrations match these filters.</div>
      ) : (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Skater</th>
                  <th>Category</th>
                  <th>Club</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th className="num">Bib</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.registrations.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.ref_code}</strong>
                      <span className="sub">{formatDateTime(r.created_at)}</span>
                    </td>
                    <td className="wrap">
                      {`${r.first_name} ${r.last_name}`}
                      <span className="sub">{`${r.gender === 'female' ? 'F' : 'M'} · age ${r.age_on_race_day}`}</span>
                    </td>
                    <td className="wrap">
                      {r.category_name}
                      <span className="sub">{eventId ? `${r.fee_birr} Birr` : r.event_name}</span>
                    </td>
                    <td className="wrap">
                      {r.club || '—'}
                      <span className="sub">{r.city}</span>
                    </td>
                    <td>
                      <a href={`tel:${r.phone}`}>{localPhone(r.phone)}</a>
                      {r.guardian_phone && <span className="sub">{`Guardian ${localPhone(r.guardian_phone)}`}</span>}
                    </td>
                    <td>
                      <Badge value={r.status} />
                    </td>
                    <td className="num">{r.bib_number ?? '—'}</td>
                    <td>
                      <div className="row-actions">
                        {r.status === 'pending' && (
                          <button type="button" className="btn btn-sm btn-ok" onClick={() => quick(r, 'approved')}>
                            Approve
                          </button>
                        )}
                        {r.status === 'approved' && (
                          <button type="button" className="btn btn-sm btn-ok" onClick={() => quick(r, 'checked_in')}>
                            Check in
                          </button>
                        )}
                        {r.status === 'pending' && (
                          <button type="button" className="btn btn-sm btn-bad" onClick={() => quick(r, 'rejected')}>
                            Reject
                          </button>
                        )}
                        <button type="button" className="btn btn-sm" onClick={() => setEditing(r)}>
                          Open
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <span>{`${data.total} registration${data.total === 1 ? '' : 's'}`}</span>
            {pages > 1 && (
              <div className="actions">
                <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Previous
                </button>
                <span>{` Page ${page} of ${pages} `}</span>
                <button type="button" className="btn btn-sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {editing && (
        <FormModal
          title={`${editing.first_name} ${editing.last_name}`}
          submitLabel="Save changes"
          onClose={() => setEditing(null)}
          extra={
            <dl>
              {[
                ['Reference', editing.ref_code],
                ['Born', `${formatDate(editing.date_of_birth, 'en')} (age ${editing.age_on_race_day} on race day)`],
                ['City · club', [editing.city, editing.club].filter(Boolean).join(' · ')],
                ['Phone', localPhone(editing.phone)],
                ['Email', editing.email || '—'],
                ['Guardian', editing.guardian_name ? `${editing.guardian_name} · ${localPhone(editing.guardian_phone)}` : '—'],
                ['T-shirt', editing.tshirt_size || '—'],
                ['Notes', editing.notes || '—'],
                ['Registered', formatDateTime(editing.created_at)],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          }
          fields={[
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              value: editing.status,
              options: [
                ['pending', 'Pending'],
                ['approved', 'Approved'],
                ['checked_in', 'Checked in'],
                ['rejected', 'Rejected'],
                ['withdrawn', 'Withdrawn'],
              ],
            },
            { name: 'bib_number', label: 'Bib number', type: 'number', value: editing.bib_number ?? '', min: 1 },
            {
              name: 'category_id',
              label: 'Category',
              type: 'select',
              full: true,
              value: editing.category_id,
              options: (event?.categories ?? []).map((c) => [c.id, `${c.name} (${c.min_age}–${c.max_age})`]),
            },
            { name: 'admin_note', label: 'Internal note', type: 'textarea', rows: 2, full: true, value: editing.admin_note, help: 'Only organisers see this.' },
          ]}
          onSubmit={async (v: FormValues) => {
            await apiFetch(`/api/admin/registrations/${editing.id}`, {
              method: 'PATCH',
              body: { ...v, bib_number: v.bib_number === '' ? null : Number(v.bib_number), category_id: Number(v.category_id) },
            });
            say('Registration saved');
            load();
          }}
        />
      )}

      {bibs && (
        <FormModal
          title="Assign bib numbers"
          submitLabel="Assign"
          onClose={() => setBibs(false)}
          extra={<p className="muted">Every approved or checked-in skater without a bib gets the next free number, in category order. Existing bibs stay the same.</p>}
          fields={[{ name: 'start_at', label: 'Start numbering at', type: 'number', value: 1, min: 1 }]}
          onSubmit={async (v) => {
            const r = await apiFetch<{ assigned: number }>(`/api/admin/events/${eventId}/assign-bibs`, {
              method: 'POST',
              body: { start_at: Number(v.start_at) || 1 },
            });
            say(`${r.assigned} bib number${r.assigned === 1 ? '' : 's'} assigned`);
            load();
          }}
        />
      )}
    </>
  );
}

/* ---------------- Events & categories ---------------- */
const eventFields = (e?: Partial<EventRow>): FieldSpec[] => [
  { name: 'name', label: 'Event name', full: true, value: e?.name ?? '' },
  { name: 'city', label: 'City', value: e?.city ?? '' },
  { name: 'venue', label: 'Venue', value: e?.venue ?? '' },
  { name: 'starts_on', label: 'First day', type: 'date', value: e?.starts_on ?? '' },
  { name: 'ends_on', label: 'Last day', type: 'date', value: e?.ends_on ?? '' },
  { name: 'registration_opens_on', label: 'Registration opens', type: 'date', value: e?.registration_opens_on ?? '' },
  { name: 'registration_closes_on', label: 'Registration closes', type: 'date', value: e?.registration_closes_on ?? '' },
  {
    name: 'status',
    label: 'Status',
    type: 'select',
    value: e?.status ?? 'draft',
    options: [
      ['draft', 'Draft — hidden from the public'],
      ['open', 'Open — accepting registrations'],
      ['closed', 'Closed — visible, no registrations'],
      ['completed', 'Completed'],
    ],
  },
  { name: 'slug', label: 'URL name', value: e?.slug ?? '', help: 'Leave empty to create it from the name.' },
  { name: 'tagline', label: 'Tagline', full: true, value: e?.tagline ?? '' },
  { name: 'description', label: 'Description', type: 'textarea', rows: 3, full: true, value: e?.description ?? '' },
];

const categoryFields = (c?: Partial<Category>): FieldSpec[] => [
  { name: 'name', label: 'Category name', full: true, value: c?.name ?? '', placeholder: 'Speed U12 Girls' },
  {
    name: 'discipline', label: 'Discipline', type: 'select', value: c?.discipline ?? 'speed',
    options: [['speed', 'Speed'], ['freestyle', 'Freestyle slalom'], ['slalom', 'Slalom'], ['relay', 'Relay']],
  },
  {
    name: 'gender', label: 'Who can enter', type: 'select', value: c?.gender ?? 'open',
    options: [['open', 'Mixed'], ['female', 'Girls and women'], ['male', 'Boys and men']],
  },
  { name: 'min_age', label: 'Minimum age', type: 'number', value: c?.min_age ?? '', min: 3 },
  { name: 'max_age', label: 'Maximum age', type: 'number', value: c?.max_age ?? '', min: 3, help: 'Use 99 for no upper limit.' },
  { name: 'distance', label: 'Distance or format', value: c?.distance ?? '', placeholder: '500 m' },
  { name: 'fee_birr', label: 'Entry fee (Birr)', type: 'number', value: c?.fee_birr ?? 0, min: 0 },
  { name: 'capacity', label: 'Places', type: 'number', value: c?.capacity ?? '', min: 1, help: 'Leave empty for unlimited.' },
  { name: 'sort_order', label: 'Order in lists', type: 'number', value: c?.sort_order ?? 0, min: 0 },
];

function Events({ events, reloadEvents, say, admin }: Shared) {
  const [modal, setModal] = useState<React.ReactNode>(null);
  const close = () => setModal(null);

  const newEvent = () =>
    setModal(
      <FormModal
        title="New event"
        submitLabel="Create event"
        fields={eventFields()}
        onClose={close}
        onSubmit={async (v) => {
          await apiFetch('/api/admin/events', { method: 'POST', body: v });
          say('Event created');
          await reloadEvents();
        }}
      />,
    );

  const editEvent = (e: EventRow) =>
    setModal(
      <FormModal
        title={`Edit ${e.name}`}
        fields={eventFields(e)}
        onClose={close}
        onSubmit={async (v) => {
          await apiFetch(`/api/admin/events/${e.id}`, { method: 'PATCH', body: v });
          say('Event saved');
          await reloadEvents();
        }}
      />,
    );

  const addCategory = (e: EventRow) =>
    setModal(
      <FormModal
        title={`New category for ${e.name}`}
        submitLabel="Add category"
        fields={categoryFields()}
        onClose={close}
        onSubmit={async (v) => {
          await apiFetch(`/api/admin/events/${e.id}/categories`, { method: 'POST', body: { ...v, capacity: v.capacity === '' ? null : v.capacity } });
          say('Category added');
          await reloadEvents();
        }}
      />,
    );

  const editCategory = (c: Category) =>
    setModal(
      <FormModal
        title={`Edit ${c.name}`}
        fields={categoryFields(c)}
        onClose={close}
        onSubmit={async (v) => {
          await apiFetch(`/api/admin/categories/${c.id}`, { method: 'PATCH', body: { ...v, capacity: v.capacity === '' ? null : v.capacity } });
          say('Category saved');
          await reloadEvents();
        }}
      />,
    );

  const confirmDelete = (message: string, run: () => Promise<void>) =>
    setModal(<ConfirmModal message={message} onClose={close} onConfirm={run} />);

  return (
    <>
      <div className="page-head">
        <h1>Events</h1>
        <button type="button" className="btn btn-primary" onClick={newEvent}>
          New event
        </button>
      </div>

      {events.length === 0 && <div className="panel empty">No events yet. Create the first one.</div>}

      {events.map((e) => (
        <section className="ev" key={e.id}>
          <div className="ev-head">
            <div>
              <h2>
                {e.name} <Badge value={e.status} />
              </h2>
              <p>
                {`${formatDate(e.starts_on, 'en')}${e.ends_on !== e.starts_on ? ` – ${formatDate(e.ends_on, 'en')}` : ''} · ${[e.venue, e.city]
                  .filter(Boolean)
                  .join(', ')} · registration ${formatDate(e.registration_opens_on, 'en')} to ${formatDate(e.registration_closes_on, 'en')}`}
              </p>
            </div>
            <div className="actions">
              <button type="button" className="btn btn-sm" onClick={() => editEvent(e)}>
                Edit event
              </button>
              {admin.role === 'owner' && (
                <button
                  type="button"
                  className="btn btn-sm btn-bad"
                  onClick={() =>
                    confirmDelete(`Delete ${e.name}? This cannot be undone.`, async () => {
                      try {
                        await apiFetch(`/api/admin/events/${e.id}`, { method: 'DELETE' });
                        say('Event deleted');
                        await reloadEvents();
                      } catch (err) {
                        say((err as ApiError).message, true);
                      }
                    })
                  }
                >
                  Delete
                </button>
              )}
            </div>
          </div>

          {e.categories.length === 0 ? (
            <p className="empty">No categories yet. Skaters cannot register until you add at least one.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Discipline</th>
                    <th>Ages</th>
                    <th>Distance</th>
                    <th className="num">Fee</th>
                    <th className="num">Taken</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {e.categories.map((c) => (
                    <tr key={c.id}>
                      <td className="wrap">
                        {c.name}
                        <span className="sub">{{ open: 'Mixed', female: 'Girls and women', male: 'Boys and men' }[c.gender as 'open']}</span>
                      </td>
                      <td>{c.discipline}</td>
                      <td>{`${c.min_age}–${c.max_age}`}</td>
                      <td>{c.distance || '—'}</td>
                      <td className="num">{`${c.fee_birr} Birr`}</td>
                      <td className="num">{c.capacity ? `${c.taken} / ${c.capacity}` : c.taken}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn-sm" onClick={() => editCategory(c)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-bad"
                            onClick={() =>
                              confirmDelete(`Delete the category ${c.name}?`, async () => {
                                try {
                                  await apiFetch(`/api/admin/categories/${c.id}`, { method: 'DELETE' });
                                  say('Category deleted');
                                  await reloadEvents();
                                } catch (err) {
                                  say((err as ApiError).message, true);
                                }
                              })
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="ev-foot">
            <button type="button" className="btn btn-sm btn-dark" onClick={() => addCategory(e)}>
              Add category
            </button>
          </div>
        </section>
      ))}

      {modal}
    </>
  );
}

/* ---------------- Results entry ---------------- */
type ResultSkater = {
  registration_id: number; first_name: string; last_name: string; club: string; bib_number: number | null;
  position: number | null; time_ms: number | null; score: string | number | null; points: number | null; outcome: string | null;
};
type Row = { registration_id: number; name: string; club: string; bib: number | null; outcome: string; position: string; perf: string; points: number | null };

function Results({ events, say }: Shared) {
  const [eventId, setEventId] = useState(String(events[0]?.id ?? ''));
  const event = events.find((e) => String(e.id) === eventId);
  const [categoryId, setCategoryId] = useState('');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = event?.categories ?? [];
  const category = categories.find((c) => String(c.id) === categoryId);
  const judged = category?.discipline === 'freestyle' || category?.discipline === 'slalom';

  useEffect(() => {
    if (!categories.some((c) => String(c.id) === categoryId)) {
      const pick = categories.find((c) => c.taken > 0) ?? categories[0];
      setCategoryId(pick ? String(pick.id) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, events]);

  const load = useCallback(async () => {
    if (!categoryId) {
      setRows(null);
      return;
    }
    const r = await apiFetch<{ skaters: ResultSkater[]; category: Category }>(`/api/admin/results?category=${categoryId}`);
    const isJudged = r.category.discipline === 'freestyle' || r.category.discipline === 'slalom';
    setRows(
      r.skaters.map((s) => ({
        registration_id: s.registration_id,
        name: `${s.first_name} ${s.last_name}`,
        club: s.club,
        bib: s.bib_number,
        outcome: s.outcome ?? 'finished',
        position: s.position === null || s.position === undefined ? '' : String(s.position),
        perf: isJudged ? (s.score === null || s.score === undefined ? '' : String(s.score)) : formatTime(s.time_ms),
        points: s.points,
      })),
    );
  }, [categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (id: number, patch: Partial<Row>) =>
    setRows((old) => (old ? old.map((r) => (r.registration_id === id ? { ...r, ...patch } : r)) : old));

  function rank() {
    if (!rows) return;
    const finished = rows
      .filter((r) => r.outcome === 'finished')
      .map((r) => ({ r, v: judged ? Number(r.perf) : (parseTime(r.perf) as number) }))
      .filter((x) => Number.isFinite(x.v))
      .sort((a, b) => (judged ? b.v - a.v : a.v - b.v));
    const positions = new Map(finished.map((x, i) => [x.r.registration_id, String(i + 1)]));
    setRows(rows.map((r) => ({ ...r, position: positions.get(r.registration_id) ?? '' })).sort((a, b) => Number(a.position || 999) - Number(b.position || 999)));
  }

  async function save() {
    if (!rows) return;
    const entries = [];
    for (const r of rows) {
      if (r.outcome === 'finished' && !r.position && !r.perf.trim()) continue; // not entered yet
      const entry: Record<string, unknown> = {
        registration_id: r.registration_id,
        outcome: r.outcome,
        position: r.outcome === 'finished' && r.position ? Number(r.position) : null,
      };
      if (judged) entry.score = r.perf.trim() ? Number(r.perf) : null;
      else {
        const ms = parseTime(r.perf);
        if (Number.isNaN(ms)) {
          say(`Check the time for ${r.name}.`, true);
          return;
        }
        entry.time_ms = ms;
      }
      entries.push(entry);
    }
    setBusy(true);
    try {
      const r = await apiFetch<{ saved: number }>('/api/admin/results', { method: 'PUT', body: { category_id: Number(categoryId), entries } });
      say(`${r.saved} result${r.saved === 1 ? '' : 's'} saved`);
      load();
    } catch (err) {
      say((err as ApiError).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-head">
        <h1>Results</h1>
      </div>

      <div className="filters">
        <label>
          Event
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grow">
          Category
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!rows || rows.length === 0 ? (
        <div className="panel empty">No approved skaters in this category yet. Approve registrations first.</div>
      ) : (
        <>
          <div className="panel">
            <p className="muted">
              {judged
                ? 'Enter each skater’s score, then rank by score. Leave a row empty to leave the skater out.'
                : 'Enter times as minutes:seconds.milliseconds (for example 1:02.345, or 38.4 for under a minute), then rank by time. Leave a row empty to leave the skater out.'}
            </p>
            <div className="actions">
              <button type="button" className="btn" onClick={rank}>
                {judged ? 'Rank by score' : 'Rank by time'}
              </button>
              <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? 'Saving…' : 'Save results'}
              </button>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th className="num">Bib</th>
                  <th>Skater</th>
                  <th>Outcome</th>
                  <th>Position</th>
                  <th>{judged ? 'Score' : 'Time'}</th>
                  <th className="num">Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.registration_id}>
                    <td className="num">{r.bib ?? '—'}</td>
                    <td className="wrap">
                      {r.name}
                      <span className="sub">{r.club}</span>
                    </td>
                    <td>
                      <select value={r.outcome} onChange={(e) => update(r.registration_id, { outcome: e.target.value })}>
                        <option value="finished">Finished</option>
                        <option value="dnf">DNF</option>
                        <option value="dns">DNS</option>
                        <option value="dq">DQ</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="res-input"
                        type="number"
                        min={1}
                        value={r.position}
                        aria-label={`Position for ${r.name}`}
                        onChange={(e) => update(r.registration_id, { position: e.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        className="res-input wide"
                        inputMode="decimal"
                        placeholder={judged ? '85.50' : '1:02.345'}
                        value={r.perf}
                        aria-label={judged ? `Score for ${r.name}` : `Time for ${r.name}`}
                        onChange={(e) => update(r.registration_id, { perf: e.target.value })}
                      />
                    </td>
                    <td className="num">{r.points ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/* ---------------- News ---------------- */
type NewsRow = { id: number; slug: string; title: string; excerpt: string; body: string; is_published: boolean; published_at: string | null };

const newsFields = (n?: Partial<NewsRow>): FieldSpec[] => [
  { name: 'title', label: 'Headline', full: true, value: n?.title ?? '' },
  { name: 'excerpt', label: 'Summary', full: true, value: n?.excerpt ?? '', help: 'One or two sentences shown in the news list.' },
  { name: 'body', label: 'Story', type: 'textarea', rows: 9, full: true, value: n?.body ?? '', help: 'Leave an empty line between paragraphs.' },
  { name: 'slug', label: 'URL name', value: n?.slug ?? '', help: 'Leave empty to create it from the headline.' },
  { name: 'is_published', label: 'Published on the site', type: 'checkbox', value: n?.is_published ?? false },
];

function News({ say }: { say: (t: string, bad?: boolean) => void }) {
  const [list, setList] = useState<NewsRow[] | null>(null);
  const [modal, setModal] = useState<React.ReactNode>(null);
  const close = () => setModal(null);
  const load = useCallback(async () => setList((await apiFetch<{ news: NewsRow[] }>('/api/admin/news')).news), []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <h1>News</h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            setModal(
              <FormModal
                title="New story"
                submitLabel="Save story"
                fields={newsFields()}
                onClose={close}
                onSubmit={async (v) => {
                  await apiFetch('/api/admin/news', { method: 'POST', body: v });
                  say(v.is_published ? 'Story published' : 'Draft saved');
                  load();
                }}
              />,
            )
          }
        >
          Write a story
        </button>
      </div>

      {!list || list.length === 0 ? (
        <div className="panel empty">No stories yet.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Headline</th>
                <th>Status</th>
                <th>Published</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((n) => (
                <tr key={n.id}>
                  <td className="wrap">
                    {n.title}
                    <span className="sub">{n.excerpt}</span>
                  </td>
                  <td>
                    <Badge value={n.is_published ? 'published' : 'draft'} />
                  </td>
                  <td>{n.published_at ? formatDate(n.published_at, 'en') : '—'}</td>
                  <td>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          setModal(
                            <FormModal
                              title="Edit story"
                              fields={newsFields(n)}
                              onClose={close}
                              onSubmit={async (v) => {
                                await apiFetch(`/api/admin/news/${n.id}`, { method: 'PATCH', body: v });
                                say('Story saved');
                                load();
                              }}
                            />,
                          )
                        }
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-bad"
                        onClick={() =>
                          setModal(
                            <ConfirmModal
                              message={`Delete “${n.title}”?`}
                              onClose={close}
                              onConfirm={async () => {
                                await apiFetch(`/api/admin/news/${n.id}`, { method: 'DELETE' });
                                say('Story deleted');
                                load();
                              }}
                            />,
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal}
    </>
  );
}

/* ---------------- Messages ---------------- */
type Message = { id: number; name: string; email: string; phone: string; topic: string; body: string; is_read: boolean; created_at: string };

function Messages({ say, onUnread }: { say: (t: string, bad?: boolean) => void; onUnread: (n: number) => void }) {
  const [list, setList] = useState<Message[] | null>(null);
  const [modal, setModal] = useState<React.ReactNode>(null);
  const load = useCallback(async () => {
    const r = await apiFetch<{ messages: Message[] }>('/api/admin/messages');
    setList(r.messages);
    onUnread(r.messages.filter((m) => !m.is_read).length);
  }, [onUnread]);
  useEffect(() => {
    load();
  }, [load]);

  const topics: Record<string, string> = {
    general: 'General', registration: 'Registration', sponsorship: 'Sponsorship', media: 'Media', volunteering: 'Volunteering',
  };

  return (
    <>
      <div className="page-head">
        <h1>Messages</h1>
      </div>
      {!list || list.length === 0 ? (
        <div className="panel empty">No messages yet.</div>
      ) : (
        list.map((m) => (
          <article className={`msg${m.is_read ? '' : ' unread'}`} key={m.id}>
            <header>
              <div>
                <h3>{`${m.name} · ${topics[m.topic] ?? m.topic}`}</h3>
                <span className="meta">
                  {formatDateTime(m.created_at)}
                  {m.email && (
                    <>
                      {' · '}
                      <a href={`mailto:${m.email}`}>{m.email}</a>
                    </>
                  )}
                  {m.phone && (
                    <>
                      {' · '}
                      <a href={`tel:${m.phone}`}>{localPhone(m.phone)}</a>
                    </>
                  )}
                </span>
              </div>
              <div className="row-actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={async () => {
                    await apiFetch(`/api/admin/messages/${m.id}`, { method: 'PATCH', body: { is_read: !m.is_read } });
                    load();
                  }}
                >
                  {m.is_read ? 'Mark unread' : 'Mark read'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-bad"
                  onClick={() =>
                    setModal(
                      <ConfirmModal
                        message="Delete this message?"
                        onClose={() => setModal(null)}
                        onConfirm={async () => {
                          await apiFetch(`/api/admin/messages/${m.id}`, { method: 'DELETE' });
                          say('Message deleted');
                          load();
                        }}
                      />,
                    )
                  }
                >
                  Delete
                </button>
              </div>
            </header>
            <p>{m.body}</p>
          </article>
        ))
      )}
      {modal}
    </>
  );
}

/* ---------------- Team & activity log ---------------- */
type Member = { id: number; email: string; name: string; role: string; last_login_at: string | null };
type AuditEntry = { id: number; admin_name: string | null; action: string; entity: string; entity_id: number | null; detail: string; created_at: string };

function Team({ admin, say }: { admin: Admin; say: (t: string, bad?: boolean) => void }) {
  const [team, setTeam] = useState<Member[] | null>(null);
  const [log, setLog] = useState<AuditEntry[] | null>(null);
  const [modal, setModal] = useState<React.ReactNode>(null);
  const close = () => setModal(null);
  const owner = admin.role === 'owner';

  const load = useCallback(async () => {
    setTeam((await apiFetch<{ team: Member[] }>('/api/admin/team')).team);
    if (owner) setLog((await apiFetch<{ entries: AuditEntry[] }>('/api/admin/audit')).entries);
  }, [owner]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <h1>Team</h1>
        <div className="actions">
          <button
            type="button"
            className="btn"
            onClick={() =>
              setModal(
                <FormModal
                  title="Change my password"
                  submitLabel="Change password"
                  extra={<p className="muted">Every other device signed in to your account will be signed out.</p>}
                  fields={[
                    { name: 'current_password', label: 'Current password', type: 'password', full: true },
                    { name: 'new_password', label: 'New password', type: 'password', full: true, help: 'At least 10 characters.' },
                  ]}
                  onClose={close}
                  onSubmit={async (v) => {
                    await apiFetch('/api/admin/password', { method: 'POST', body: v });
                    say('Password changed');
                  }}
                />,
              )
            }
          >
            Change my password
          </button>
          {owner && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                setModal(
                  <FormModal
                    title="Add a team member"
                    submitLabel="Add member"
                    fields={[
                      { name: 'name', label: 'Name' },
                      { name: 'email', label: 'Email', type: 'email' },
                      {
                        name: 'role', label: 'Role', type: 'select', value: 'staff', full: true,
                        options: [['staff', 'Staff — manage everything except the team'], ['owner', 'Owner — full access']],
                      },
                      { name: 'password', label: 'Temporary password', full: true, help: 'At least 10 characters. Ask them to change it after signing in.' },
                    ]}
                    onClose={close}
                    onSubmit={async (v) => {
                      await apiFetch('/api/admin/team', { method: 'POST', body: v });
                      say('Team member added');
                      load();
                    }}
                  />,
                )
              }
            >
              Add a team member
            </button>
          )}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Last sign-in</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(team ?? []).map((m) => (
              <tr key={m.id}>
                <td className="wrap">
                  {m.name}
                  <span className="sub">{m.email}</span>
                </td>
                <td>{m.role}</td>
                <td>{m.last_login_at ? formatDateTime(m.last_login_at) : 'Never'}</td>
                <td>
                  {owner && m.id !== admin.id && (
                    <button
                      type="button"
                      className="btn btn-sm btn-bad"
                      onClick={() =>
                        setModal(
                          <ConfirmModal
                            message={`Remove ${m.name}? They will no longer be able to sign in.`}
                            okLabel="Remove"
                            onClose={close}
                            onConfirm={async () => {
                              try {
                                await apiFetch(`/api/admin/team/${m.id}`, { method: 'DELETE' });
                                say('Removed');
                                load();
                              } catch (err) {
                                say((err as ApiError).message, true);
                              }
                            }}
                          />,
                        )
                      }
                    >
                      Remove
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {owner && (
        <section className="panel" style={{ marginTop: 18 }}>
          <h2>Activity log</h2>
          {!log || log.length === 0 ? (
            <p className="muted">No activity yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Who</th>
                    <th>Action</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {log.slice(0, 100).map((a) => (
                    <tr key={a.id}>
                      <td>{formatDateTime(a.created_at)}</td>
                      <td>{a.admin_name ?? '—'}</td>
                      <td>{`${a.action.replace('_', ' ')} ${a.entity}${a.entity_id ? ` #${a.entity_id}` : ''}`}</td>
                      <td className="wrap">{a.detail.length > 120 ? `${a.detail.slice(0, 120)}…` : a.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {modal}
    </>
  );
}

