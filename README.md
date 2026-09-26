# Super Champion — Next.js full-stack

The Super Champion website and organiser system, built with **Next.js 15 (App Router) + TypeScript + PostgreSQL**, packaged for a **VPS with Docker**.

**Public site** (`/en`, `/am`) — server-rendered, in English and Amharic with a one-tap switch. Hero with the next event and a live countdown, the meaning of the name, the logo and brand colours, a category finder, a four-step registration form, status lookup, results with podiums, season standings, news, the race-day gallery, FAQ and contact details. Amharic dates use the **Ethiopian calendar** (ህዳር 13 ቀን 2019 ዓ.ም); English dates the Gregorian one (22 November 2026).

**Organiser panel** (`/admin`) — dashboard, registrations (approve, reject, check in, edit, search, filter, CSV export), automatic bib numbers, events and categories, results entry with automatic points, news editor, messages, team accounts and an activity log.

> **Before you deploy:** this project was written for you but **has not been installed or run** in the place it was written — there was no internet there to run `npm install`. The code is complete and every file parses, but the first `npm install && npm run build` is yours. If the build reports a type error, `npm run typecheck` will point at the exact line, and `typescript.ignoreBuildErrors` in `next.config.ts` lets you ship while you fix it.

---

## What runs where

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, React 19 | Pages are rendered on the server, so search engines and slow phones get real HTML. |
| Language | TypeScript, `strict` | Mistakes surface while you edit, not on race day. |
| Database | PostgreSQL 16 via `pg` and plain SQL | No ORM to learn or upgrade; migrations are readable SQL. |
| Validation | zod | One schema validates and types each request. |
| Auth | scrypt + HMAC-signed session cookie (`node:crypto`) | No extra dependency, and no token is readable by page scripts. |
| Hosting | Docker Compose on a VPS, Nginx in front | One command to start, one file to back up. |

Interactive parts (countdown, category finder, registration wizard, results tabs, admin panel) are client components; everything else is rendered on the server.

## Quick start on your computer

```bash
cp .env.example .env         # fill in DB_PASSWORD and SESSION_SECRET
npm install
docker compose up -d db      # or point DATABASE_URL at any Postgres you have
npm run migrate              # creates the tables
npm run seed                 # loads Super Champion 2026 and its ten categories
npm run dev                  # http://localhost:3000
```

The site is at `/` (it redirects to `/en` or `/am`), the panel at `/admin`.

### Your organiser account

Put `ADMIN_EMAIL` and `ADMIN_PASSWORD` (10+ characters) in `.env` before the first `npm run seed`, and an **owner** account is created if none exists. Delete `ADMIN_PASSWORD` afterwards. Or create one any time:

```bash
npm run create-admin -- --email mikiyasbedlu3@gmail.com --name "Mikiyas Bedilu" --role owner
```

Owners can add staff from **Team**. Staff can do everything except manage the team, delete events and read the activity log.

## Deploy to a VPS

```bash
# on the server
git clone <your repo> /opt/super-champion && cd /opt/super-champion
cp .env.example .env && nano .env          # DB_PASSWORD, SESSION_SECRET, SITE_URL, ADMIN_EMAIL, ADMIN_PASSWORD
docker compose up -d --build
docker compose exec app node_modules/.bin/tsx scripts/lib/migrate.ts   # first time only
docker compose exec app node_modules/.bin/tsx scripts/lib/seed.ts      # first time only

# Nginx + certificate
cp deploy/nginx.conf /etc/nginx/sites-available/superchampion   # change the domain inside
ln -s /etc/nginx/sites-available/superchampion /etc/nginx/sites-enabled/
certbot --nginx -d superchampion.et -d www.superchampion.et
systemctl reload nginx
```

The app listens on `127.0.0.1:3000`, so only Nginx can reach it. Logs: `docker compose logs -f app`.

**Updating:** `git pull && docker compose up -d --build`. Migrations that you add later are applied with the same `migrate` command.

**Backups:** `deploy/backup.sh` writes a compressed dump and keeps 30 days. Add it to cron:

```
15 3 * * * /opt/super-champion/deploy/backup.sh
```

Copy `backups/` off the server regularly.

### Hosted Postgres instead (Neon, Supabase)

Set `DATABASE_URL` to their connection string and `DATABASE_SSL=1`, then drop the `db` service from `docker-compose.yml`.

## Settings

| Setting | What it does |
|---|---|
| `DATABASE_URL` | Postgres connection string. |
| `DATABASE_SSL` | `1` for hosted Postgres that requires TLS. |
| `SESSION_SECRET` | 32+ random characters signing admin sessions. Changing it signs everyone out. The app refuses to start in production without it. |
| `TRUST_PROXY` | `1` behind Nginx or Cloudflare, so rate limits see the visitor's real IP. |
| `SITE_URL` | Your public address. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | First owner account, used only when no admin exists. |
| `SESSION_HOURS` | How long an organiser stays signed in (default 12). |

## Security

- Passwords hashed with **scrypt**; sign-in is rate-limited per IP *and* per account and takes the same time whether or not the email exists.
- Sessions are HMAC-signed tokens in an **HttpOnly, SameSite=Strict** cookie. Changing your password signs out every other device.
- State-changing admin requests from other sites are rejected (Origin check).
- Security headers and a Content-Security-Policy are set in `src/middleware.ts`. Next needs `'unsafe-inline'` for its own bootstrap script and injected styles; everything else is limited to this origin and Google Fonts.
- Every input is validated on the server with zod; Ethiopian phone numbers are normalised to `+2519…`.
- Rate limits on registration, status lookup, contact and sign-in; hidden honeypot fields catch form bots.
- Status lookup needs **both** the reference code and the phone number, so codes cannot be guessed.
- The public API never returns phone numbers or dates of birth.
- CSV exports neutralise spreadsheet formulas and carry a UTF-8 marker so Amharic names open correctly in Excel.
- All admin changes are written to the activity log.

Rate limits live in memory, which suits one container. Running several copies behind a load balancer means moving them to Redis.

## Running a competition

1. **Events** — create the event (starts as *Draft*, hidden), add categories with age range, gender, distance, fee and places. Set it to *Open*.
2. Skaters register. Age counts on the first day of the event; the form only offers categories that fit and the server checks again. Under-18s need a guardian. The same skater cannot enter the same event twice.
3. **Registrations** — approve once payment is confirmed; filter, search, export.
4. **Assign bib numbers** — every approved skater without a bib gets the next number, in category order.
5. Race day — *Check in* each skater.
6. **Results** — enter times (`1:02.345` or `38.4`) or freestyle scores, press *Rank*, then *Save*. Points (25, 18, 15, 12, 10, 8, 6, 4, 2, 1) are added automatically and the public pages update at once.
7. Set the event to *Completed*.

## Project layout

```
src/
  middleware.ts               language redirect + security headers
  lib/
    env.ts                    settings, with production checks
    db.ts                     Postgres pool, query and transaction helpers
    migrate.ts                SQL migrations (npm run migrate)
    seed.ts / create-admin.ts setup scripts
    auth.ts                   scrypt, sessions, admin guard
    validation.ts             zod schemas, phone normalising
    domain.ts                 ages, eligibility, points, Ethiopian dates, CSV
    queries.ts                shared reads for pages and API
    dictionaries.ts           every line of site text, en + am
    client.ts                 browser fetch helper
  app/
    (site)/[lang]/            public site (server components)
    (admin)/admin/            organiser panel
    api/                      public and admin route handlers
  components/site/            countdown, finder, wizard, results, news, contact
  components/admin/           panel views and form modals
public/assets/img/            logo variants and gallery photos
deploy/                       Nginx, backup script
```

## Changing things

- **Text, in both languages** — `src/lib/dictionaries.ts`. Every line has an `en` and an `am` version.
- **Colours and fonts** — the variables at the top of `src/app/globals.css`.
- **Contact phone and email** — the contact section in `src/app/(site)/[lang]/page.tsx`.
- **Gallery photos** — replace the files in `public/assets/img/gear/`.
- **Points table** — `POINTS` in `src/lib/domain.ts`.
- **Database changes** — add a new entry to `MIGRATIONS` in `src/lib/migrate.ts`. Never edit one that has already run.

## API

Public: `GET /api/health`, `/api/site`, `/api/events`, `/api/events/:slug`, `/api/events/:slug/results`, `/api/standings`, `/api/news`, `/api/news/:slug`; `POST /api/registrations`, `/api/contact`; `GET /api/registrations/status?ref=&phone=`.

Organiser (session cookie): `/api/admin/login`, `logout`, `me`, `password`, `stats`, `events` (+ `/:id`, `/:id/categories`, `/:id/assign-bibs`), `categories/:id`, `registrations` (+ `/:id`, `/export`), `results`, `news` (+ `/:id`), `messages` (+ `/:id`), `team` (+ `/:id`), `audit`.

Errors always look like `{ "error": "message", "fields": { "phone": "…" } }`.
