import { currentAdmin, assertSameOrigin, type Admin } from '@/lib/auth';
import { HttpError } from '@/lib/api';

/** Every admin route starts here: same-origin check, then a valid session. */
export async function requireAdmin(req: Request): Promise<Admin> {
  assertSameOrigin(req);
  const admin = await currentAdmin();
  if (!admin) throw new HttpError(401, 'Sign in to continue.');
  return admin;
}

export function requireOwner(admin: Admin): void {
  if (admin.role !== 'owner') throw new HttpError(403, 'Only the owner can do this.');
}

export async function audit(adminId: number, action: string, entity: string, entityId: number | null, detail: unknown = ''): Promise<void> {
  const { run } = await import('@/lib/db');
  await run('INSERT INTO audit_log (admin_id, action, entity, entity_id, detail) VALUES ($1,$2,$3,$4,$5)', [
    adminId, action, entity, entityId, typeof detail === 'string' ? detail : JSON.stringify(detail),
  ]);
}
