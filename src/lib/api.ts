import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { env } from './env';
import { fieldErrors } from './validation';
import { isUniqueViolation } from './db';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (message: string, fields?: Record<string, string>) => new HttpError(400, message, fields);
export const notFound = (message = 'Not found.') => new HttpError(404, message);
export const conflict = (message: string) => new HttpError(409, message);

export const json = <T>(data: T, status = 200, headers?: HeadersInit) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', ...(headers ?? {}) } });

/** Wraps a route handler so thrown errors become tidy JSON instead of stack traces. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return json({ error: err.message, ...(err.fields ? { fields: err.fields } : {}) }, err.status);
      }
      if (err instanceof ZodError) {
        return json({ error: 'Some fields need attention.', fields: fieldErrors(err) }, 400);
      }
      if (err instanceof Error && err.message === 'CROSS_SITE') {
        return json({ error: 'Cross-site request blocked.' }, 403);
      }
      if (isUniqueViolation(err)) return json({ error: 'That record already exists.' }, 409);
      const id = Math.random().toString(36).slice(2, 10);
      console.error(`[api:${id}]`, err);
      return json({ error: 'Something went wrong on our side. Try again in a moment.', request_id: id }, 500);
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  const type = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new HttpError(415, 'Send the request body as JSON.');
  let data: unknown;
  try {
    data = await req.json();
  } catch {
    throw badRequest('Invalid JSON body.');
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) throw badRequest('The request body must be a JSON object.');
  return data as Record<string, unknown>;
}

export function clientIp(req: Request): string {
  if (env.trustProxy) {
    const xff = req.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/* ---------- Rate limiting (in memory; right for a single VPS instance) ---------- */
type Bucket = { count: number; reset: number };
const globalForLimits = globalThis as unknown as { scLimits?: Map<string, Bucket> };
const buckets: Map<string, Bucket> = globalForLimits.scLimits ?? new Map();
globalForLimits.scLimits = buckets;

const RULES = {
  register: { windowMs: 60 * 60_000, max: 15 },
  lookup: { windowMs: 15 * 60_000, max: 30 },
  contact: { windowMs: 60 * 60_000, max: 8 },
  login: { windowMs: 15 * 60_000, max: 8 },
  api: { windowMs: 60_000, max: 240 },
} as const;

export type LimitName = keyof typeof RULES;

export function rateLimit(name: LimitName, key: string): void {
  const rule = RULES[name];
  const now = Date.now();
  const id = `${name}:${key}`;
  let bucket = buckets.get(id);
  if (!bucket || bucket.reset <= now) {
    bucket = { count: 0, reset: now + rule.windowMs };
    buckets.set(id, bucket);
  }
  bucket.count++;
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  if (bucket.count > rule.max) {
    const minutes = Math.ceil((bucket.reset - now) / 60_000);
    throw new HttpError(429, `Too many requests. Try again in ${minutes} minute(s).`);
  }
}

export const resetLimit = (name: LimitName, key: string): void => void buckets.delete(`${name}:${key}`);
