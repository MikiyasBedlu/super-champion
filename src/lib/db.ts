import { Pool, types, type PoolClient, type QueryResultRow } from 'pg';

/* DATE columns come back as plain 'YYYY-MM-DD' strings instead of JS Dates.
   Race days have no time zone, and this keeps them from shifting by a day. */
types.setTypeParser(1082, (value: string) => value);
import { env } from './env';

/* One pool per process. In development Next reloads modules, so it is cached on globalThis. */
const globalForDb = globalThis as unknown as { scPool?: Pool };

export const pool: Pool =
  globalForDb.scPool ??
  new Pool({
    connectionString: env.databaseUrl,
    ssl: env.databaseSsl ? { rejectUnauthorized: false } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (!env.isProd) globalForDb.scPool = pool;

pool.on('error', (err) => console.error('[db] idle client error', err));

export async function all<R extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<R[]> {
  const res = await pool.query<R>(sql, params as never[]);
  return res.rows;
}

export async function one<R extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<R | null> {
  const rows = await all<R>(sql, params);
  return rows[0] ?? null;
}

export async function run(sql: string, params: unknown[] = []): Promise<number> {
  const res = await pool.query(sql, params as never[]);
  return res.rowCount ?? 0;
}

/** Runs the callback inside a transaction. Rolls back on any error. */
export async function tx<T>(fn: (client: TxClient) => Promise<T>): Promise<T> {
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(wrap(client));
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export type TxClient = {
  all: <R extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<R[]>;
  one: <R extends QueryResultRow>(sql: string, params?: unknown[]) => Promise<R | null>;
  run: (sql: string, params?: unknown[]) => Promise<number>;
};

function wrap(client: PoolClient): TxClient {
  return {
    all: async <R extends QueryResultRow>(sql: string, params: unknown[] = []) => (await client.query<R>(sql, params as never[])).rows,
    one: async <R extends QueryResultRow>(sql: string, params: unknown[] = []) => (await client.query<R>(sql, params as never[])).rows[0] ?? null,
    run: async (sql: string, params: unknown[] = []) => (await client.query(sql, params as never[])).rowCount ?? 0,
  };
}

/** Postgres unique-violation code, used to turn duplicates into friendly 409s. */
export const isUniqueViolation = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
