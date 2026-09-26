import { run } from '@/lib/db';
import { badRequest, clientIp, handle, json, rateLimit, readJson } from '@/lib/api';
import { contactSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export const POST = handle(async (req: Request) => {
  rateLimit('contact', clientIp(req));
  const v = contactSchema.parse(await readJson(req));
  if (!v.email && !v.phone) throw badRequest('Some fields need attention.', { email: 'Give an email or a phone number so we can reply.' });
  // Anything that fills the hidden field is a bot: accept quietly, store nothing.
  if (!v.website) {
    await run('INSERT INTO messages (name, email, phone, topic, body) VALUES ($1,$2,$3,$4,$5)', [v.name, v.email, v.phone, v.topic, v.body]);
  }
  return json({ ok: true }, 201);
});
