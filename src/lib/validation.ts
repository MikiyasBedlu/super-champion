import { z } from 'zod';

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const clean = (max: number, multiline = false) =>
  z
    .string()
    .max(max * 2)
    .transform((s) => {
      const stripped = s.replace(CONTROL, '');
      return multiline ? stripped.replace(/\r\n/g, '\n').trim() : stripped.replace(/\s+/g, ' ').trim();
    })
    .pipe(z.string().max(max, `Keep this to ${max} characters or fewer.`));

export const text = (max = 200) => clean(max);
export const longText = (max = 2000) => clean(max, true);
export const requiredText = (min: number, max: number, message: string) =>
  clean(max).pipe(z.string().min(min, message));

/** Ethiopian mobile numbers: 09…, 07…, +2519…, 2517… → +2519XXXXXXXX */
export function normalisePhone(value: string | undefined | null): string | null {
  const digits = String(value ?? '').replace(/[\s\-().]/g, '');
  const m = /^(?:\+?251|0)?([79]\d{8})$/.exec(digits);
  return m ? `+251${m[1]}` : null;
}

export const phone = (required = true) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim())
    .superRefine((v, ctx) => {
      if (!v) {
        if (required) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a phone number.' });
        return;
      }
      if (!normalisePhone(v)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter an Ethiopian mobile number, for example 0911 234 567.' });
      }
    })
    .transform((v) => (v ? (normalisePhone(v) as string) : ''));

export const email = (required = false) =>
  z
    .string()
    .optional()
    .transform((v) => (v ?? '').trim().toLowerCase())
    .superRefine((v, ctx) => {
      if (!v) {
        if (required) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter an email address.' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid email address.' });
      }
    });

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker (YYYY-MM-DD).')
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'That date does not exist.');

export const registrationSchema = z.object({
  event_slug: text(80),
  category_id: z.coerce.number().int().positive(),
  first_name: requiredText(1, 60, 'Enter the first name.'),
  last_name: requiredText(1, 60, 'Enter the last name.'),
  date_of_birth: isoDate,
  gender: z.enum(['male', 'female']),
  city: requiredText(2, 60, 'Enter the city.'),
  club: text(80).optional().default(''),
  phone: phone(true),
  email: email(false),
  guardian_name: text(80).optional().default(''),
  guardian_phone: phone(false),
  tshirt_size: z.enum(['', 'YS', 'YM', 'YL', 'S', 'M', 'L', 'XL', 'XXL']).optional().default(''),
  notes: longText(500).optional().default(''),
  consent: z.boolean(),
  website: z.string().max(200).optional().default(''), // honeypot
});

export const contactSchema = z.object({
  name: requiredText(2, 80, 'Enter your name.'),
  email: email(false),
  phone: phone(false),
  topic: z.enum(['general', 'registration', 'sponsorship', 'media', 'volunteering']),
  body: longText(2000).pipe(z.string().min(10, 'Write a little more — at least 10 characters.')),
  website: z.string().max(200).optional().default(''),
});

export const loginSchema = z.object({
  email: email(true),
  password: z.string().min(1, 'Enter your password.').max(200),
});

export const eventSchema = z.object({
  name: requiredText(3, 120, 'Enter the event name.'),
  slug: z
    .string()
    .max(80)
    .regex(/^[a-z0-9-]*$/, 'Use lowercase letters, numbers and hyphens.')
    .optional()
    .default(''),
  tagline: text(160).optional().default(''),
  description: longText(4000).optional().default(''),
  city: requiredText(2, 60, 'Enter the city.'),
  venue: text(120).optional().default(''),
  starts_on: isoDate,
  ends_on: isoDate,
  registration_opens_on: isoDate,
  registration_closes_on: isoDate,
  status: z.enum(['draft', 'open', 'closed', 'completed']),
});

export const categorySchema = z.object({
  name: requiredText(2, 80, 'Enter the category name.'),
  discipline: z.enum(['speed', 'freestyle', 'slalom', 'relay']),
  gender: z.enum(['open', 'male', 'female']),
  min_age: z.coerce.number().int().min(3).max(90),
  max_age: z.coerce.number().int().min(3).max(99),
  distance: text(60).optional().default(''),
  fee_birr: z.coerce.number().int().min(0).max(100000),
  capacity: z.union([z.coerce.number().int().min(1).max(5000), z.null()]).optional().default(null),
  sort_order: z.coerce.number().int().min(0).max(1000).optional().default(0),
});

export const registrationPatchSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'withdrawn', 'checked_in']).optional(),
  bib_number: z.union([z.coerce.number().int().min(1).max(99999), z.null()]).optional(),
  admin_note: longText(500).optional(),
  category_id: z.coerce.number().int().positive().optional(),
});

export const resultsSchema = z.object({
  category_id: z.coerce.number().int().positive(),
  entries: z
    .array(
      z.object({
        registration_id: z.coerce.number().int().positive(),
        outcome: z.enum(['finished', 'dnf', 'dns', 'dq']),
        position: z.union([z.coerce.number().int().min(1).max(1000), z.null()]).optional().default(null),
        time_ms: z.union([z.coerce.number().int().min(0).max(86_400_000), z.null()]).optional().default(null),
        score: z.union([z.coerce.number().min(0).max(1000), z.null()]).optional().default(null),
      }),
    )
    .max(1000),
});

export const newsSchema = z.object({
  title: requiredText(3, 160, 'Enter a headline.'),
  slug: z
    .string()
    .max(90)
    .regex(/^[a-z0-9-]*$/, 'Use lowercase letters, numbers and hyphens.')
    .optional()
    .default(''),
  excerpt: text(300).optional().default(''),
  body: longText(20000).optional().default(''),
  is_published: z.boolean().optional().default(false),
});

export const teamSchema = z.object({
  email: email(true),
  name: requiredText(2, 80, 'Enter a name.'),
  role: z.enum(['owner', 'staff']),
  password: z.string().min(10, 'Use at least 10 characters.').max(200),
});

export const passwordSchema = z.object({
  current_password: z.string().min(1).max(200),
  new_password: z.string().min(10, 'Use at least 10 characters.').max(200),
});

/** Turns a Zod error into { field: message } for the forms. */
export function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.') || 'form';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
