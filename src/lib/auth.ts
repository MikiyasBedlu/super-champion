import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { env } from './env';
import { one, run } from './db';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, PARAMS.keylen, { N: PARAMS.N, r: PARAMS.r, p: PARAMS.p });
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length, { N: Number(N), r: Number(r), p: Number(p) });
  return key.length === expected.length && crypto.timingSafeEqual(key, expected);
}

/* Burns the same amount of time when the email is unknown, so sign-in timing
   does not reveal which accounts exist. */
let dummyHash: string | null = null;
export async function burnPasswordCheck(password: string): Promise<void> {
  if (!dummyHash) dummyHash = await hashPassword('not-a-real-password');
  await verifyPassword(password, dummyHash);
}

export type Admin = { id: number; email: string; name: string; role: 'owner' | 'staff'; session_version: number };

type SessionPayload = { sub: number; sv: number; exp: number };

export function signSession(admin: Pick<Admin, 'id' | 'session_version'>): string {
  const payload: SessionPayload = {
    sub: admin.id,
    sv: admin.session_version,
    exp: Math.floor(Date.now() / 1000) + env.sessionHours * 3600,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', env.sessionSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySession(token: string | undefined): SessionPayload | null {
  if (!token || token.length > 512) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', env.sessionSecret).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'sc_session';

export async function setSessionCookie(admin: Pick<Admin, 'id' | 'session_version'>): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, signSession(admin), {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.isProd,
    path: '/',
    maxAge: env.sessionHours * 3600,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'strict', secure: env.isProd, path: '/', maxAge: 0 });
}

/** Returns the signed-in admin, or null. Session version lets a password change sign out other devices. */
export async function currentAdmin(): Promise<Admin | null> {
  const store = await cookies();
  const payload = verifySession(store.get(SESSION_COOKIE)?.value);
  if (!payload) return null;
  const admin = await one<Admin>('SELECT id, email, name, role, session_version FROM admins WHERE id = $1', [payload.sub]);
  if (!admin || admin.session_version !== payload.sv) return null;
  return admin;
}

/** Blocks state-changing requests that come from another site (defence in depth on top of SameSite=Strict). */
export function assertSameOrigin(req: Request): void {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const origin = req.headers.get('origin');
  if (!origin) return; // non-browser clients send no Origin
  const host = (env.trustProxy && req.headers.get('x-forwarded-host')) || req.headers.get('host');
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    /* falls through to the mismatch below */
  }
  if (!host || originHost !== host) throw new Error('CROSS_SITE');
}

export async function bootstrapAdmin(): Promise<void> {
  const { email, password, name } = env.bootstrapAdmin;
  if (!email || password.length < 10) return;
  const existing = await one<{ n: string }>('SELECT COUNT(*) AS n FROM admins');
  if (Number(existing?.n ?? 0) > 0) return;
  await run('INSERT INTO admins (email, name, role, password_hash) VALUES ($1, $2, $3, $4)', [
    email,
    name,
    'owner',
    await hashPassword(password),
  ]);
  console.log(`[auth] created owner account for ${email} — remove ADMIN_PASSWORD from the environment now.`);
}

const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export function refCode(): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += REF_ALPHABET[crypto.randomInt(REF_ALPHABET.length)];
  return `SC-${s}`;
}
