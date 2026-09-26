/* Environment settings. Read once, validated once. */
const required = (name: string, value: string | undefined, minLength = 1): string => {
  if (!value || value.length < minLength) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${name} must be set (at least ${minLength} characters) in production.`);
    }
    return '';
  }
  return value;
};

const devSecret = 'development-only-secret-do-not-use-in-production-0123456789';

export const env = {
  isProd: process.env.NODE_ENV === 'production',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://superchampion:superchampion@localhost:5432/superchampion',
  databaseSsl: process.env.DATABASE_SSL === '1',
  sessionSecret: required('SESSION_SECRET', process.env.SESSION_SECRET, 32) || devSecret,
  sessionHours: Number(process.env.SESSION_HOURS ?? 12),
  trustProxy: process.env.TRUST_PROXY === '1',
  siteUrl: process.env.SITE_URL ?? 'http://localhost:3000',
  bootstrapAdmin: {
    email: (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD ?? '',
    name: process.env.ADMIN_NAME ?? 'Admin',
  },
};

if (!env.isProd && env.sessionSecret === devSecret) {
  console.warn('[env] SESSION_SECRET is not set — using a development secret. Set it before going live.');
}
