# PHASE 1 — Foundation, Architecture, Authentication and Multi-Tenancy

**Branch:** `phase/01-foundation` (create from the latest `main`, never from another phase branch)
**Prerequisites:** none (this is the first phase). **Read `/prompts/README.md` in full before starting.**
**Depends on:** nothing. **Blocks:** every other phase.

---

## 1. Objective

Turn this repository into a **clean, building, deployable Next.js 14 App Router application** with working
Supabase authentication, a company (tenant) model, company membership, Row Level Security that provably isolates
tenants, and a protected dashboard shell — using the existing shadcn/Tailwind UI rather than rebuilding it.

This phase establishes the architectural decisions, conventions and tooling that all later phases depend on.
It must end with the production build, lint, typecheck, and the RLS isolation test all passing.

**Product framing (unchanged):** UnitPass gives HVAC companies a digital service passport per installed unit,
reachable by a permanent QR code. Phase 1 builds no product surface beyond authentication, tenancy and a shell.

---

## 2. Preconditions and branch setup

```bash
git status                                   # must be clean; if not, stop and report
git fetch origin --prune
git checkout main
git pull --ff-only origin main
git log --oneline -5                         # record the base commit for the report
git checkout -b phase/01-foundation
git push -u origin phase/01-foundation       # if push fails, report the exact command the owner must run
```

If `pnpm` is not installed: `corepack enable --install-directory /usr/local/bin pnpm` (use pnpm 9.x — the lockfile is
`lockfileVersion: '9.0'`). Install with `pnpm install --frozen-lockfile` (do **not** create `package-lock.json`).

---

## 3. Scope

### 3.1 Resolve the architecture (audit result is known — verify it yourself first)

The repo contains two app directories and two conflicting scaffolds. Confirmed facts (see `/prompts/README.md` §1):

* Next resolves root `./app` before `./src/app`, so `src/app/**` (which holds the real product code: auth pages,
  dashboard, customers, setup-company) is currently **never compiled**.
* `src/pages/**` is treated as a **Pages Router** directory and `src/pages/NotFound.tsx` imports `react-router-dom`
  (not installed) → build failure.
* root `app/layout.tsx` imports `./globals.css` which does not exist → build failure.
* Vite/Dyad leftovers (`index.html`, `src/App.css`, `src/vite-env.d.ts`, `tsconfig.app.json`, `tsconfig.node.json`,
  `vercel.json` SPA rewrite, `src/components/made-with-dyad.tsx`) contradict the Next.js app.

**Required action:** adopt **`src/app` as the single canonical App Router directory** and delete root `app/`
(3 files, all placeholder/broken). Rationale: the entire product surface, the `@/*` → `./src/*` path alias, the
shadcn kit (`src/components/ui`, 49 files) and `src/lib/utils.ts` already live under `src/`; deleting root `app/`
moves zero product files and is the smallest correct change. Next then resolves `src/app` automatically.

If — and only if — you find a concrete technical blocker, choose the alternative, state it in the completion report,
and record the final decision in the repo `README.md`. There must be exactly **one** app directory when you finish.

**Delete (only after confirming nothing else imports them):**

* `app/` (root, entire directory)
* `lib/supabase.ts` (root duplicate of `src/lib/supabase.ts`)
* `src/pages/` (entire directory — Vite/React-Router leftovers)
* `index.html`, `src/App.css`, `src/vite-env.d.ts`
* `tsconfig.app.json`, `tsconfig.node.json` (Vite project-reference files; `tsconfig.node.json` references a
  nonexistent `vite.config.ts`)
* `src/components/made-with-dyad.tsx`
* `vercel.json` (SPA rewrite `/(.*) → /index.html` breaks Next routing on Vercel; Vercel auto-detects Next.js)
* `src/components/ui/calendar.tsx` **only if** you do not install `react-day-picker` (it imports a package that is not
  installed and nothing uses it). Do not install `react-day-picker` for a component nobody imports.
* Tracked build output: `git rm -r --cached .next` and `git rm --cached tsconfig.tsbuildinfo` (if tracked), then add
  both to `.gitignore`. **Do not delete the working-tree contents of `.next/`** — just stop tracking it.

**Keep:** `src/app/**` (fix it, don't rewrite it wholesale), `src/components/**` incl. the whole shadcn kit,
`src/lib/utils.ts`, `src/hooks/**`, `src/globals.css`, `tailwind.config.ts`, `postcss.config.js`, `components.json`.

Retire the legacy schema file: `git mv supabase/schema.sql supabase/legacy/schema.sql.txt` (it is not runnable — see
`/prompts/README.md` §1.3 — but keep it as reference). Migrations become authoritative.

### 3.2 Establish tooling and configuration

* `package.json`:
  * add `"packageManager": "pnpm@9.15.9"` and `"engines": { "node": ">=20" }`;
  * scripts: `dev`, `build`, `start`, `lint`, **`typecheck` (`tsc --noEmit`)**, and `format` only if you add Prettier
    (optional — do not add Prettier if it is not already there; skip).
* `tsconfig.json`: replace the broken solution-style config (references + `files: []` + a broad `include`) with a
  single Next-compatible config: `strict` may stay `false` initially, but keep `paths: { "@/*": ["./src/*"] }`,
  `moduleResolution: "bundler"`, `jsx: "preserve"`, `noEmit: true`, `include: ["next-env.d.ts", "**/*.ts", "**/*.tsx",
  ".next/types/**/*.ts"]`, `exclude: ["node_modules"]`. Next patches it on build; commit the final state.
  (*Optional but cheap and recommended:* turn `strict` on where it produces no new errors — do not spend the phase on
  type debt; note anything deferred.)
* **ESLint** — currently unavailable (`next lint` cannot read the Vite-style flat `eslint.config.js` in Next 14).
  Establish a working lint command. Recommended: remove `eslint.config.js` and use
  `eslint@^8.57.x` + `eslint-config-next@14.2.35` with `.eslintrc.json` (`{ "extends": ["next/core-web-vitals"] }`,
  `"ignorePatterns": [".next", "node_modules"]`), keeping the `lint` script as `next lint`.
  Alternative: keep ESLint 9 flat config with `eslint-config-next` via `FlatCompat` and set the script to
  `eslint .`. Either way: `pnpm lint` must run **non-interactively** and exit 0 on a clean tree.
  (The Vite-only devDeps `eslint-plugin-react-refresh`, `@eslint/js`, `typescript-eslint`, `globals` may be removed if
  you switch to `.eslintrc.json`; removing them is optional.)
* `next.config.mjs`: add a minimal typed config (no `images` entries yet; Phase 3 adds what it needs).
* `components.json`: update `tailwind.css` to the real stylesheet path and set `"rsc": true`.
* `.gitignore`: add `.env`, `.env*.local`, `.env.*` (but keep `!.env.example`), `.next/`, `*.tsbuildinfo`,
  `.vercel`, plus the existing entries.
* Add `src/app/globals.css` only if you decide to move the stylesheet; otherwise import the existing
  `src/globals.css` from the root layout (e.g. `import '@/globals.css'`). Do not duplicate Tailwind directives in two
  files.
* Rewrite `AI_RULES.md` (currently instructs React Router, `src/App.tsx` routes, `src/pages/Index.tsx` as the main
  page, and "do not edit shadcn files" — all wrong here) into a short, accurate file pointing at
  `/prompts/README.md` and the canonical structure.
* Update the repo `README.md`: what UnitPass is, local setup (Node 22, pnpm, `pnpm install`, `.env.local` from
  `.env.example`, Supabase project creation, applying migrations, `pnpm dev`), the verification commands, and the
  phase/branch workflow. Remove the "Welcome to your Dyad app" placeholder.

### 3.3 Supabase clients and environment handling

* Install `@supabase/supabase-js` and **`@supabase/ssr`**. **Do not** install the deprecated
  `@supabase/auth-helpers-nextjs` (the old code imports it — remove those imports).
* Create:
  * `src/lib/supabase/client.ts` — `createBrowserClient` for client components;
  * `src/lib/supabase/server.ts` — `createServerClient` reading/writing cookies via `next/headers`
    (`cookies()`), usable from Server Components, Server Actions and route handlers;
  * `src/lib/supabase/middleware.ts` — the standard "refresh session cookies on every request" helper.
  * (Do **not** create an admin/service-role client yet — create it in the first phase that needs it.)
* **Fail fast:** if a required public env var is missing, throw a clear error naming the variable (e.g.
  `Missing NEXT_PUBLIC_SUPABASE_URL. Copy .env.example to .env.local.`). Do not fall back to dummy values.
* Add `.env.example` (names + short comments only) with: `NEXT_PUBLIC_SITE_URL`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL` (used by migration/RLS test scripts).
  Never commit real values; confirm `.env*` is untracked.
* Create `middleware.ts` (repo root) or `src/middleware.ts` (pick one and document it): refresh the Supabase session
  cookie and redirect unauthenticated requests for `/dashboard*` to `/auth/sign-in`. Ensure the middleware matcher
  excludes static assets and the auth routes.

### 3.4 Authentication

Rework `src/app/auth/**` (keep the existing routes/URLs; fix the implementation):

* **Files needing interactivity must be Client Components** (`'use client'`): sign-in, sign-up, forgot-password,
  reset-password. (`src/app/auth/check-email/page.tsx` can stay a Server Component.)
* **Sign-up** — email + password via the browser client with
  `emailRedirectTo: \`${NEXT_PUBLIC_SITE_URL}/auth/callback\``. Redirect to `/auth/check-email`.
* **Callback** — `src/app/auth/callback/route.ts` must be a **route handler** (not a page) that exchanges the PKCE
  code for a session (`exchangeCodeForSession`) and redirects to `/dashboard` (or `/auth/sign-in` on failure). The
  current `src/app/auth/callback/page.tsx` only redirects and never establishes a session — replace it.
* **Sign-in** — after success, `router.refresh()` and navigate to `/dashboard`; the dashboard layout decides whether
  the user still needs company setup.
* **Sign-out** — implement as a Server Action (`src/app/auth/actions.ts`, e.g. `signOut`) using the server client and
  `redirect('/')`. The existing `src/auth.ts` uses a browser-only client and `window.location`; replace it and delete
  the old file if unused.
* **Forgot / reset password** — `resetPasswordForEmail` with `redirectTo: \`${NEXT_PUBLIC_SITE_URL}/auth/reset-password\``;
  the reset page updates the password via `supabase.auth.updateUser`. The existing page requires `access_token` /
  `refresh_token` query params, which is not how the current Supabase flow delivers a session — implement the
  standard `@supabase/ssr` recovery-session flow instead (the `/auth/callback` route can exchange the recovery code,
  after which the user lands on `/auth/reset-password` with a session; the page must handle "no session → show
  invalid/expired link" gracefully).
* Show clear, non-leaking error and loading states; require password length ≥ 8 client-side; keep Supabase's
  server-side rules authoritative.
* Ensure every auth page is mobile-friendly and looks intentional (use the shadcn `Input`, `Label`, `Button`,
  `Card` components instead of raw unstyled inputs where cheap).

### 3.5 Company (tenant) model, membership and onboarding

* Company creation is **atomic and server-side**: implement the `SECURITY DEFINER` RPC
  `public.create_company_with_owner(...)` (see §4) and call it from a **Server Action** (e.g.
  `src/app/dashboard/setup-company/actions.ts`). Never insert a company + membership from the browser, and never
  accept `company_id` from a form.
* Rebuild `src/app/dashboard/setup-company/page.tsx` as: Server Component page (auth check) + Client Component form
  (fields: company name, contact name, phone, email, website, address, default service interval in months — default
  12). Logo upload is **out of scope** (Phase 2; the legacy `logo_url` column may remain unused).
* After company creation, redirect to `/dashboard`.
* Routing rules (implement in the dashboard layout / page):
  * not signed in → `/auth/sign-in`;
  * signed in, no company membership → `/dashboard/setup-company`;
  * signed in with a company → dashboard.
  Derive membership from `company_members` (the source of truth), not only from `profiles.company_id`.
* Legacy code in `src/app/dashboard/customers/**` and the stats-heavy `src/app/dashboard/page.tsx` reference tables
  that do not exist yet and patterns this phase replaces. **Delete `src/app/dashboard/customers/**`** (Phase 2
  rebuilds customers properly) and replace `src/app/dashboard/page.tsx` with a clean Phase-1 dashboard:
  welcome + company summary (name, contact, phone, email, address, default interval) + a "next steps" empty state
  that does not fabricate statistics and does not reference unavailable features. Record the deletions in the report
  (the code remains in git history).

### 3.6 Dashboard shell and navigation

* `src/app/dashboard/layout.tsx` must be a **Server Component** that (a) reads the session server-side,
  (b) redirects unauthenticated users, and (c) renders the shell. Replace the current implementation, which calls
  `useAuthStatus` from the deprecated auth-helpers package and calls `router.push` during render.
* Rebuild `src/components/Sidebar.tsx`: keep its visual language (Tailwind, no new dependencies), but
  **only show navigation for features that exist in this phase**: Dashboard, and the signed-in user's email +
  Sign out. Do not render Customers/Equipment/Services/Documents/Billing links. Accept and render the company name.
* Mobile: below `md`, the navigation collapses into a sheet/drawer (shadcn `Sheet` in `src/components/ui/sheet.tsx`
  is available — add `"use client"` to components that need it). A fixed 64-column sidebar on a phone is a bug.
* Add `"use client"` to shadcn UI components you actually import into client components **and** that use hooks or
  context (e.g. `toast.tsx`, `toaster.tsx`, `sonner.tsx`, `tooltip.tsx`, `dropdown-menu.tsx`, `sheet.tsx`,
  `dialog.tsx`, `label.tsx`, `input.tsx`, `button.tsx` only if it uses hooks — inspect before editing). Keep edits
  minimal; do not reformat the kit.
* Root layout (`src/app/layout.tsx`): Server Component, `metadata` (title UnitPass, description from §11 of the
  README), no `next/font/google` (it fails without internet access — use a system font stack or a self-hosted font),
  import the stylesheet, and mount `Providers` — a small `'use client'` component that renders `Toaster` + `Sonner` +
  `TooltipProvider`. Do not add `QueryClientProvider` unless something in this phase actually uses react-query.
* Keep `src/app/page.tsx` as the public landing page; only fix what blocks the build (e.g.
  `import { Image } from 'next/image'` → default import). Do not polish or redesign it — that is Phase 8.

### 3.7 Database migrations (this phase creates the tenancy foundation)

Create `supabase/migrations/` and add **one idempotent migration**,
e.g. `supabase/migrations/20261007000001_phase1_foundation.sql`, containing:

1. `create extension if not exists pgcrypto;`
2. `public.companies`, `public.profiles`, `public.company_members` with:
   * UUID PKs (`gen_random_uuid()`), `created_at`/`updated_at timestamptz not null default now()`;
   * `profiles.id uuid primary key references auth.users(id) on delete cascade` (1:1 with auth users),
     `profiles.company_id uuid references public.companies(id) on delete set null`, `full_name text`,
     `avatar_url text`;
   * `companies`: `name text not null`, `logo_url text`, `contact_name text`, `phone text`, `email text`,
     `website text`, `address text`, `default_service_interval integer not null default 12`;
   * `company_members`: `id uuid pk`, `user_id uuid not null references auth.users(id) on delete cascade`,
     `company_id uuid not null references public.companies(id) on delete cascade`,
     `role text not null check (role in ('owner','admin','technician'))`,
     `unique (user_id, company_id)`;
   * indexes: `company_members(user_id)`, `company_members(company_id)`, `profiles(company_id)`.
     **Do not create `customers`/`equipment`/… here** — later phases own those tables. (If you have DB access and find
     some of them already exist from the legacy script, leave them untouched and say so in the report.)
3. `public.set_updated_at()` trigger function + triggers on the three tables.
4. RLS helper functions (§8.3 of the README pattern):
   * `public.is_company_member(target_company uuid) returns boolean`
   * `public.is_company_admin(target_company uuid) returns boolean`
   Both `security definer`, `stable`, `set search_path = ''`, execute granted to `authenticated` only.
   **These exist specifically to prevent the recursive-policy bug in the legacy script.**
5. `public.handle_new_user()` + `after insert on auth.users` trigger creating the `profiles` row
   (`full_name` from `raw_user_meta_data->>'full_name'` when present), `security definer`.
6. `public.create_company_with_owner(p_name text, p_contact_name text default null, p_phone text default null,
   p_email text default null, p_website text default null, p_address text default null,
   p_default_service_interval integer default 12) returns uuid` — `security definer`, validates `auth.uid() is not
   null`, inserts the company, inserts the founder's `company_members` row with role `owner`, updates
   `profiles.company_id`, returns the new company id. `grant execute` to `authenticated` only.
7. RLS enabled on all three tables, with policies:
   * `companies`: `select` when `is_company_member(id)`; `update` when `is_company_admin(id)`;
     **no insert policy** (creation only via the RPC). Explicitly
     `drop policy if exists "Authenticated users can insert companies" on public.companies;` if the legacy script may
     have been applied — any authenticated user being able to insert arbitrary companies is not acceptable.
   * `profiles`: `select`/`update` when `id = auth.uid()`; `insert` with check `id = auth.uid()`.
   * `company_members`: `select` when `is_company_member(company_id)`; `insert`/`update`/`delete` when
     `is_company_admin(company_id)`.
   * Also **drop the legacy recursive policies** on these tables (`is_company_member`-style predicates replaced).
8. Explicit privilege hygiene: `revoke all on public.companies, public.profiles, public.company_members from anon;`
   and grant the needed privileges to `authenticated` (`select`, `insert`, `update`, `delete` as appropriate).

Write the migration **idempotently** (`create table if not exists`, `create or replace function`, `drop policy if
exists` before `create policy`, `add column if not exists`). Apply it if DB credentials are available:
`psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql`, or document the exact owner steps
(Supabase CLI `supabase db push --db-url "$SUPABASE_DB_URL"`, or paste into the SQL editor). State clearly in the
report whether it was applied or only authored.

### 3.8 Tenant isolation tests (required deliverable)

Create `supabase/tests/rls_tenant_isolation.sql` using the pattern in `/prompts/README.md` §7.2. It must, inside a
single transaction that ends with `rollback`:

* create two auth users and two companies (with memberships) as the superuser/service role;
* impersonate Company A's user (`set local role authenticated; set local request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';`)
  and assert:
  1. A can `select` its own company row; count = 1;
  2. A `select` from `companies` returns **zero** rows for B (`where id = <B>` yields 0 rows);
  3. A `select` from `company_members` returns only A's membership;
  4. A's `update` of B's company row affects **0** rows;
  5. A's `insert` into `company_members` for B fails (with check violation);
  6. A's `insert` into `companies` directly fails (no insert policy);
  7. `create_company_with_owner()` as A creates a company where A is `owner` and B cannot see it;
  8. A cannot read B's `profiles` row.
* Fail loudly (`raise exception 'FAIL: …'`) on any violation; print a success summary; end with `rollback`.

Also add a small helper script `supabase/tests/README.md` documenting how to run it and what it proves.

Add `supabase/tests/check_rls_enabled.sql` (or a documented one-liner) that lists public tables and asserts
`relrowsecurity = true` for every tenant table — the report must include its output.

---

## 4. Explicit exclusions (do NOT build in Phase 1)

Customers CRUD, equipment, QR codes, public UnitPass pages, service records, documents/storage, reminders/email,
Stripe/billing, invites/team management, roles UI, multi-company switching UI, logo upload, marketing polish,
analytics, exports, notifications, dark-mode toggle, i18n, custom auth providers (Google etc.), a test framework.

If a tempting improvement is not required by §3, write it into `FUTURE PHASE NOTES` instead of building it.

---

## 5. Security requirements

1. Tenant isolation is enforced in the database (RLS) **and** scoped in app queries; `company_id` is never read from
   the browser for authorization.
2. No client-side use of a service-role key anywhere (a service-role client is not created in this phase at all).
3. RLS is enabled on every table this phase creates, and the isolation test in §3.8 passes (or is reported
   `UNVERIFIED` with the exact owner command if no DB access is available).
4. RPCs that create tenant data are `SECURITY DEFINER` + `set search_path = ''` + executable by `authenticated` only.
5. `anon` has no privileges on tenant tables.
6. `/dashboard*` is protected server-side (middleware **and** layout check).
7. Auth error messages do not leak whether an email exists (use Supabase defaults; keep the generic
   "If an account exists…" copy on forgot-password).
8. No secrets in git: `.env*` untracked, `.env.example` contains names only. Check `git log --all -- .env` is empty;
   report if it is not.
9. Build output (`.next`) and `*.tsbuildinfo` are untracked.
10. No public route in this phase exposes tenant data.

---

## 6. Acceptance criteria

* [ ] Exactly one app directory exists; `src/app` (or the documented alternative) is canonical; the conflicting
      scaffold is deleted.
* [ ] `pnpm install --frozen-lockfile` succeeds; no `package-lock.json` exists.
* [ ] `pnpm typecheck` passes (baseline was 7 errors — all resolved or explicitly justified); `pnpm lint` runs
      non-interactively and passes; `pnpm build` **PASSES** for the first time.
* [ ] `pnpm dev` serves `/` (landing) and `/auth/sign-in` without runtime errors.
* [ ] Sign-up → email confirmation path → sign-in → company creation → dashboard works end-to-end (or is documented
      as owner-verifiable with exact steps if email confirmation cannot be exercised).
* [ ] Forgot-password → reset-password → sign-in with the new password works (or is documented owner-verifiable).
* [ ] Sign-out returns the user to `/` and `/dashboard` then redirects to `/auth/sign-in`.
* [ ] Signed-in user without a company is redirected to `/dashboard/setup-company`; after creating a company they land
      on `/dashboard` and see their company details.
* [ ] Unauthenticated `GET /dashboard` responds with a redirect (verified with `curl -sI`), not a client-side
      redirect after render.
* [ ] `supabase/tests/rls_tenant_isolation.sql` passes against a real database (or is reported `UNVERIFIED` with the
      exact owner command) — the 8 assertions in §3.8.
* [ ] RLS-enabled check query returns `true` for every tenant table.
* [ ] Sidebar shows only Dashboard + sign-out (+ user/company identity) and is usable at 375 px width.
* [ ] `README.md` documents setup/run/verify; `AI_RULES.md` no longer contradicts the architecture; `prompts/` is
      untouched except for a new decisions-log row.
* [ ] No future-phase features were implemented.

---

## 7. Tests and verification (run these; paste real results in the report)

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm build                       # must PASS (this is the phase's headline gate)

# behaviour
pnpm dev &                       # or the process tool; then:
curl -sI http://localhost:3000/ | head -1                    # 200
curl -sI http://localhost:3000/dashboard | head -5           # 307/302 → /auth/sign-in
curl -sI http://localhost:3000/auth/sign-in | head -1        # 200

# secrets / hygiene
git ls-files | grep -E '^\.env' || echo "no env files tracked"
git ls-files | grep -c '^\.next/' || echo "no .next tracked"
grep -rn "service_role" src app 2>/dev/null || echo "no service-role references"

# database (only with credentials)
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<migration>.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
psql "$SUPABASE_DB_URL" -c "select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1;"
```

**Manual test matrix** (record pass/fail per row; do the cross-tenant row with two real accounts if a Supabase
project is configured):

| # | Test | Expected |
|---|---|---|
| 1 | `/` loads, landing content visible, mobile width OK | pass |
| 2 | Sign up with a new email | confirmation email sent (or documented dev setting) |
| 3 | Sign in with the confirmed account | redirected to setup-company (no company) |
| 4 | Create a company with valid data | redirected to dashboard, company name shown |
| 5 | Reload `/dashboard` | stays on dashboard (no bounce to setup) |
| 6 | Sign out, then `GET /dashboard` | redirected to `/auth/sign-in` |
| 7 | Forgot password → email link → set new password → sign in | works |
| 8 | Second account creates a second company | cannot see the first company (SQL test + UI check) |
| 9 | 375 px viewport | no horizontal scroll; nav reachable |

---

## 8. Environment variables and external services

Add to `.env.example` (names only): `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_DB_URL`. No `SUPABASE_SERVICE_ROLE_KEY` is needed in Phase 1 code.

Owner configuration required (document it in `README.md`): create a Supabase project, run the migration, set the
Site URL and redirect URLs in Supabase Auth to include `${NEXT_PUBLIC_SITE_URL}/auth/callback` and
`${NEXT_PUBLIC_SITE_URL}/auth/reset-password`, and decide whether email confirmation is required
(dev: can be disabled in the Supabase dashboard; production: keep it on).

If no credentials are available: implement everything, then report `SECURITY CHECK: UNVERIFIED` and
`SAFE TO MERGE: NO`, with the exact commands the owner must run (migration + isolation test + RLS-enabled query).

---

## 9. Files expected to change (guide, not an exhaustive list)

Deleted: `app/**`, `lib/supabase.ts`, `src/pages/**`, `index.html`, `src/App.css`, `src/vite-env.d.ts`,
`tsconfig.app.json`, `tsconfig.node.json`, `src/components/made-with-dyad.tsx`, `vercel.json`,
`src/app/dashboard/customers/**`, optionally `src/components/ui/calendar.tsx`, `eslint.config.js` (if switching to
`.eslintrc.json`).

Added: `supabase/migrations/<phase1>.sql`, `supabase/tests/rls_tenant_isolation.sql`,
`supabase/tests/check_rls_enabled.sql`, `supabase/tests/README.md`, `supabase/legacy/schema.sql.txt` (moved),
`.env.example`, `next.config.mjs`, `middleware.ts` or `src/middleware.ts`, `src/lib/supabase/{client,server,middleware}.ts`,
`src/app/providers.tsx`, `src/app/auth/callback/route.ts`, `src/app/auth/actions.ts`,
`src/app/dashboard/setup-company/actions.ts`, `.eslintrc.json` (if used).

Modified: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `.gitignore`, `README.md`, `AI_RULES.md`,
`components.json`, `src/app/layout.tsx`, `src/app/page.tsx` (build fix only), `src/app/dashboard/layout.tsx`,
`src/app/dashboard/page.tsx`, `src/app/auth/**`, `src/components/Sidebar.tsx`, and the shadcn UI components that need
`"use client"`.

---

## 10. Deferred (record under FUTURE PHASE NOTES)

Invites/roles UI, multi-company switching, logo upload (Phase 2), email templates beyond Supabase defaults,
`strict` TypeScript cleanup if not completed, typed Supabase schema generation (`supabase gen types`) if not done
here, any react-query usage, removing unused dependencies (Phase 8), and every product surface (Phases 2–8).

Consider generating Supabase types (`supabase gen types typescript --db-url "$SUPABASE_DB_URL" > src/lib/supabase/types.ts`)
**only if** the DB is reachable; otherwise skip and note it — do not hand-write a large fake type file.

---

## 11. Stop conditions (stop and report instead of guessing)

* The working tree is dirty at the start, or `main` does not contain what you expect.
* Restructuring would require rewriting the shadcn kit or the landing page beyond build fixes.
* The migration cannot be made idempotent/safe for an unknown existing database state, or the DB contains data you
  would have to destroy.
* Auth flows cannot work without a Supabase project and the owner's decisions (email confirmation on/off) — implement
  and document, but say so.
* Push/branch creation is unavailable.

---

## 12. Phase completion report

Finish with the standard report from `/prompts/README.md` §6, filled in completely. At minimum:

* state whether the migration was **applied** or only authored;
* state whether the isolation test **ran** (paste the command and result summary) or is `UNVERIFIED`;
* list every deleted file (with the reason) and every dependency added/removed;
* confirm `pnpm build` now passes and note the removed pre-existing failures from the baseline
  (`/prompts/README.md` §1.2);
* set `SAFE TO MERGE` honestly — `NO` if migrations/RLS are unverified, or the build/lint/typecheck gates fail.
