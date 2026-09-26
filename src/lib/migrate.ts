/* Database migrations. Run with: npm run migrate
   Each migration runs once, in order, inside a transaction. Never edit a shipped
   migration — add a new one to the end of the list. */
import { pool } from './db';

const MIGRATIONS: string[] = [
  `
  CREATE TABLE admins (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','staff')),
    session_version INTEGER NOT NULL DEFAULT 1,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX idx_admins_email ON admins (lower(email));

  CREATE TABLE events (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    tagline TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL,
    venue TEXT NOT NULL DEFAULT '',
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    registration_opens_on DATE NOT NULL,
    registration_closes_on DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed','completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    discipline TEXT NOT NULL CHECK (discipline IN ('speed','freestyle','slalom','relay')),
    gender TEXT NOT NULL DEFAULT 'open' CHECK (gender IN ('open','male','female')),
    min_age INTEGER NOT NULL,
    max_age INTEGER NOT NULL,
    distance TEXT NOT NULL DEFAULT '',
    fee_birr INTEGER NOT NULL DEFAULT 0,
    capacity INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CHECK (min_age <= max_age)
  );
  CREATE INDEX idx_categories_event ON categories (event_id);

  CREATE TABLE registrations (
    id SERIAL PRIMARY KEY,
    ref_code TEXT NOT NULL UNIQUE,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE RESTRICT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    date_of_birth DATE NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male','female')),
    city TEXT NOT NULL,
    club TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    guardian_name TEXT NOT NULL DEFAULT '',
    guardian_phone TEXT NOT NULL DEFAULT '',
    tshirt_size TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending','approved','rejected','withdrawn','checked_in')),
    bib_number INTEGER,
    admin_note TEXT NOT NULL DEFAULT '',
    identity_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  -- One active entry per skater per event, and one bib number per event.
  CREATE UNIQUE INDEX idx_reg_identity ON registrations (event_id, identity_key)
    WHERE status NOT IN ('rejected','withdrawn');
  CREATE UNIQUE INDEX idx_reg_bib ON registrations (event_id, bib_number) WHERE bib_number IS NOT NULL;
  CREATE INDEX idx_reg_event_status ON registrations (event_id, status);
  CREATE INDEX idx_reg_category ON registrations (category_id);

  CREATE TABLE results (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    position INTEGER,
    time_ms INTEGER,
    score NUMERIC(6,2),
    points INTEGER NOT NULL DEFAULT 0,
    outcome TEXT NOT NULL DEFAULT 'finished' CHECK (outcome IN ('finished','dnf','dns','dq')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (category_id, registration_id)
  );
  CREATE INDEX idx_results_event ON results (event_id, category_id);

  CREATE TABLE news (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    topic TEXT NOT NULL DEFAULT 'general',
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    admin_id INTEGER REFERENCES admins(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id INTEGER,
    detail TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  CREATE INDEX idx_audit_created ON audit_log (created_at DESC);
  `,
];

export async function migrate(): Promise<number> {
  const client = await pool.connect();
  let applied = 0;
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    const { rows } = await client.query<{ v: number }>('SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrations');
    const current = Number(rows[0].v);
    for (let i = current; i < MIGRATIONS.length; i++) {
      await client.query('BEGIN');
      try {
        await client.query(MIGRATIONS[i]);
        await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [i + 1]);
        await client.query('COMMIT');
        applied++;
        console.log(`[migrate] applied migration ${i + 1}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${i + 1} failed: ${(err as Error).message}`);
      }
    }
  } finally {
    client.release();
  }
  return applied;
}

if (process.argv[1] && process.argv[1].includes('migrate')) {
  migrate()
    .then((n) => {
      console.log(n ? `Done — ${n} migration(s) applied.` : 'Database is already up to date.');
      return pool.end();
    })
    .catch((err) => {
      console.error(err.message);
      process.exit(1);
    });
}
