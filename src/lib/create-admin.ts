/* Creates an organiser account.
   Usage: npm run create-admin -- --email you@example.com --name "Mikiyas Bedilu" --role owner
   The password is read from NEW_ADMIN_PASSWORD, or asked for. */
import readline from 'node:readline/promises';
import { pool, one, run } from './db';
import { hashPassword } from './auth';

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main(): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const email = (arg('email') ?? (await rl.question('Email: '))).trim().toLowerCase();
  const name = arg('name') ?? (await rl.question('Name: '));
  const role = arg('role') ?? 'owner';
  const password = process.env.NEW_ADMIN_PASSWORD ?? (await rl.question('Password (10+ characters): '));
  rl.close();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('That email is not valid.');
  if (password.length < 10) throw new Error('The password must be at least 10 characters.');
  if (!['owner', 'staff'].includes(role)) throw new Error('The role must be owner or staff.');
  if (await one('SELECT 1 FROM admins WHERE lower(email) = $1', [email])) throw new Error('That email already has an account.');

  await run('INSERT INTO admins (email, name, role, password_hash) VALUES ($1,$2,$3,$4)', [email, name || 'Admin', role, await hashPassword(password)]);
  console.log(`Created ${role} account for ${email}.`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err.message);
    await pool.end();
    process.exit(1);
  });
