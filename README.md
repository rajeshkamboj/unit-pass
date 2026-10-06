# UnitPass

**The Digital Service Passport for HVAC Equipment.**

HVAC companies record the equipment they install. Every record gets a permanent QR code. The homeowner scans it to
open a mobile-friendly digital passport (equipment details, warranty, service history, documents, company contact and a
**Book Service** action), while the company is reminded when the unit is due for maintenance — turning installations
into repeat service revenue.

> **Where the project is today:** Phase 1 (foundation, authentication, multi-tenancy) is implemented. Product features
> (customers, equipment, QR codes, public passports, service history, documents, reminders, billing) arrive in
> Phases 2–8. See [`prompts/README.md`](prompts/README.md) for the phase plan and the rules agents must follow.

---

## 1. Architecture

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 14.2 (App Router)** | Single app directory: **`src/app`** |
| Language | TypeScript | `pnpm typecheck` runs `tsc --noEmit` |
| Styling | **Tailwind CSS 3** + **shadcn/ui** | Components in `src/components/ui` |
| Database / Auth | **Supabase** (PostgreSQL + RLS + Auth) | Migrations in `supabase/migrations` |
| Package manager | **pnpm 9** (lockfile committed) | `packageManager: pnpm@9.15.9` |
| Node | **>= 20** (22 recommended) | `engines.node` |
| Hosting | **Vercel** | no `vercel.json` needed yet (cron is added in Phase 6) |

```
src/
  app/                     # App Router (canonical — there is no root app/ directory)
    layout.tsx             # server layout: metadata, providers, globals.css
    page.tsx               # public landing page
    providers.tsx          # client providers (toaster/sonner/tooltip)
    auth/                  # sign-in, sign-up, forgot/reset password, check-email, callback route
    dashboard/             # protected shell (server-side session check)
  components/
    ui/                    # shadcn/ui primitives
    Sidebar.tsx            # dashboard navigation (mobile-aware)
  lib/
    supabase/              # client.ts (browser) · server.ts (server) · middleware.ts
    session.ts             # requireUser() / getUserMembership() / requireCompany()
    types.ts               # hand-written row types for the Phase 1 tables
    utils.ts               # cn()
  globals.css              # Tailwind entry + design tokens
middleware.ts              # session refresh + /dashboard guard
supabase/
  migrations/              # authoritative schema (timestamped, idempotent)
  tests/                   # SQL security tests (see supabase/tests/README.md)
  legacy/schema.sql.txt    # the original Dyad schema, reference only — do not run
prompts/                   # the phased development playbook
```

**Conventions**

* Writes go through **Server Actions**; the tenant (`company_id`) is always derived server-side from
  `company_members`. A `company_id` sent by the browser is never trusted.
* Supabase clients: `@supabase/ssr` (`createBrowserClient` / `createServerClient`). The deprecated
  `@supabase/auth-helpers-nextjs` is intentionally **not** used.
* The service-role key is not used in Phase 1 at all. When a later phase needs it (signed URLs, cron, webhooks) it
  must live in a server-only module and never reach the client bundle.

---

## 2. Local development

```bash
# 1. Prerequisites: Node 20+ and pnpm 9
corepack enable --install-directory /usr/local/bin pnpm   # if pnpm is not installed

# 2. Install
pnpm install --frozen-lockfile

# 3. Configure environment
cp .env.example .env.local        # then fill in the values from section 3

# 4. Run
pnpm dev                          # http://localhost:3000
```

### Verification commands

```bash
pnpm typecheck    # TypeScript, must be clean
pnpm lint         # ESLint (next lint), must be clean
pnpm build        # production build
```

Database security tests (see [`supabase/tests/README.md`](supabase/tests/README.md)):

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/check_rls_enabled.sql
```

---

## 3. Supabase setup (required before the app can sign anyone in)

1. **Create a project** at [supabase.com](https://supabase.com) and copy from *Project Settings → API*:
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` into `.env.local`.
2. **Copy the connection string** (*Project Settings → Database → Connection string → URI*) into `SUPABASE_DB_URL`
   (used only by the migration/test scripts, never by the app at runtime).
3. **Apply the migrations** (authoritative schema):

   ```bash
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261007000001_phase1_foundation.sql
   ```

   Or paste the file into the Supabase SQL editor. The migration is idempotent and also repairs a database where the
   legacy `supabase/legacy/schema.sql.txt` was applied earlier (it removes the old recursive policies).
4. **Verify the security guarantees** by running the two scripts in `supabase/tests/` (section 2).
5. **Auth URLs** — in *Authentication → URL Configuration*:
   * *Site URL*: `http://localhost:3000` for dev, your production domain later.
   * *Redirect URLs*: add `${NEXT_PUBLIC_SITE_URL}/auth/callback` and `${NEXT_PUBLIC_SITE_URL}/auth/reset-password`
     (`http://localhost:3000/**` is acceptable for local development).
6. **Email confirmation** — *Authentication → Providers → Email*. Keep it **on** for production. For faster local
   testing you may turn it off; the app handles both (it detects an immediate session after sign-up and goes straight
   to the dashboard).

### What the database guarantees (Phase 1)

| Table | Contents | Access |
|---|---|---|
| `companies` | one row per HVAC company (tenant) | members read; admins update; **no direct insert** — companies are only created by the `create_company_with_owner()` function |
| `profiles` | 1:1 with `auth.users` (auto-created by a trigger) | a user reads/updates only their own row |
| `company_members` | user ↔ company + role (`owner`/`admin`/`technician`) | members read their company's members; admins manage them |

* RLS is enabled on all three tables; `anon` has **no** privileges on them.
* `public.is_company_member()` / `public.is_company_admin()` are `SECURITY DEFINER` helpers used by the policies —
  this is what prevents the "infinite recursion detected in policy" failure of the legacy schema.
* `company_members` is the source of truth for tenancy; `profiles.company_id` is only a convenience pointer.

---

## 4. Environment variables

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | Canonical origin used for auth redirects and (later) QR payloads. Set it to your real domain **before** printing QR labels. |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anonymous key (RLS-protected) |
| `SUPABASE_DB_URL` | dev/CI only | Postgres connection string for migration and test scripts |

Rules: only variable **names** live in `.env.example`; real values go in `.env.local` (gitignored) or the hosting
provider's environment settings. A missing public variable fails fast at runtime with a message naming the variable —
the production build itself does not require credentials.

**Deployment (Vercel):** import the repository, set the variables above for each environment, and deploy. No
`vercel.json` is required in Phase 1.

---

## 5. Phase workflow (for the owner and for AI agents)

Development is split into eight phases, one branch each, merged by the owner:

```
main → phase/01-foundation → owner reviews → merge into main
     → phase/02-customers   → owner reviews → merge into main   → …
```

Branches: `phase/01-foundation`, `phase/02-customers`, `phase/03-unitpass-qr`, `phase/04-service-history`,
`phase/05-documents`, `phase/06-reminders`, `phase/07-billing`, `phase/08-production`.

To run a phase, open a new agent session and say **"Complete Phase N"**. The agent is required to read
[`prompts/README.md`](prompts/README.md), then [`prompts/prompt-phaseN.md`](prompts), verify the previous phases are in
`main`, branch from the latest `main`, implement only that phase, run the verification commands, and finish with a
PHASE COMPLETION REPORT including `SAFE TO MERGE: YES/NO`.

Rules that apply to every phase: never merge or push to `main`, never delete a phase branch, never commit secrets,
never expose private data on public pages, and never build features from a later phase.

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Missing NEXT_PUBLIC_SUPABASE_URL` | `.env.local` is absent or incomplete — copy `.env.example` and fill it in, then restart `pnpm dev`. |
| Sign-up email never arrives | Check *Authentication → URL Configuration* redirect URLs and the email template; check spam; the Supabase built-in SMTP is rate-limited (a custom SMTP is needed for real use). |
| Sign-in works but `/dashboard` bounces to sign-in | The session cookie is not being set (wrong `NEXT_PUBLIC_SUPABASE_URL`) or the middleware matcher was edited. |
| Password reset link → "Link expired" | The link was already used, expired, or the `redirectTo` URL is not allowlisted in Supabase. |
| `permission denied for table …` in tests | You are running the isolation test as a role that cannot `set role authenticated`; run it as the migration owner (`postgres`). |
| `infinite recursion detected in policy` | The legacy schema is still applied — run the Phase 1 migration, which replaces those policies. |

---

## 7. Repository history note

This repository started as a Dyad-generated Vite/React scaffold with a partially migrated Next.js App Router app.
Phase 1 removed the conflicting scaffold (root `app/`, `src/pages/`, Vite config files, the committed `.next/` build
output, the SPA `vercel.json`) and made `src/app` canonical. The old schema is preserved for reference at
`supabase/legacy/schema.sql.txt`; it is not runnable and must not be applied.
