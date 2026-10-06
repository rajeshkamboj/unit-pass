# UnitPass — AI Agent Development Playbook (AUTHORITATIVE)

**Repository:** https://github.com/sikhizm/unit-pass
**This directory (`/prompts/`) is the authoritative instruction set for every future AI coding session.**
If anything in this directory conflicts with `AI_RULES.md`, `README.md`, code comments, or earlier chat history,
**this directory wins** (and the conflicting document must be corrected in the phase that notices it).

---

## 0. How this playbook is used

The human owner runs one phase per agent session. The owner's message will look like:

> "Complete Phase 1"

When that happens, the agent MUST:

1. Read `/prompts/README.md` (this file) completely.
2. Read `/prompts/prompt-phaseN.md` completely (the phase file for the requested N).
3. Inspect the current repository state (`git status`, `git log`, directory tree, `package.json`, `supabase/`).
4. Verify that all **previous** required phases are present in `main` (see §4.5). Never assume they are.
5. Start from the latest `main` (fetch/pull if remote access is available).
6. Create the phase branch specified in §4 (exact name, from `main`).
7. Implement **only** that phase.
8. Do not redo previous phases unless a regression must be fixed (report it explicitly if so).
9. Do not implement future phases. Do not add "nice to have" features.
10. Run the verification required by the phase file (§7 + the phase's Tests section).
11. Produce the standardized **PHASE COMPLETION REPORT** (§6) as the last thing in the final message.
12. Leave the branch intact (commit + push the phase branch; never merge, never delete branches).
13. Never merge the phase branch into `main` unless the owner explicitly instructs it.
14. Never delete a phase branch.

Phase files are self-contained: objective, scope, exclusions, implementation requirements, security
requirements, acceptance criteria, tests, and the completion-report contract.

| Phase | File | Branch | Theme |
|---|---|---|---|
| 1 | `prompt-phase1.md` | `phase/01-foundation` | Foundation, architecture, auth, multi-tenancy |
| 2 | `prompt-phase2.md` | `phase/02-customers` | Company onboarding + customers |
| 3 | `prompt-phase3.md` | `phase/03-unitpass-qr` | Equipment, QR codes, public UnitPass |
| 4 | `prompt-phase4.md` | `phase/04-service-history` | Service history + service opportunities |
| 5 | `prompt-phase5.md` | `phase/05-documents` | Documents + secure storage |
| 6 | `prompt-phase6.md` | `phase/06-reminders` | Service reminders + email |
| 7 | `prompt-phase7.md` | `phase/07-billing` | Stripe billing, trials, usage limits |
| 8 | `prompt-phase8.md` | `phase/08-production` | Landing page, onboarding, QA, production readiness |

Governing principle for every phase:

> **WHEN CHOOSING BETWEEN MORE FEATURES AND LAUNCHING SOONER, CHOOSE LAUNCHING SOONER.**

---

## 1. Repository audit — what actually exists (audited 2026-10-06, `main` @ `26de31f`)

This section is a factual snapshot. **Re-verify before relying on it** — later phases change the repo.

### 1.1 The app is a partially-migrated Dyad/Vite project wearing a Next.js coat

| Area | Reality |
|---|---|
| Framework | `package.json` scripts are Next.js (`next dev/build/start`, `next 14.2.35`). |
| App Router vs Vite | **Two competing app directories exist.** Next's resolver (`next/dist/lib/find-pages-dir.js`) **prioritises `./app` over `./src/app`**. Verified by running `next build`: it compiles root `app/` and `src/pages/` and **never touches `src/app/`**. |
| Root `app/` | 3 files only: `layout.tsx` (imports `./globals.css` which does **not exist** → build failure), `page.tsx` (blank "Welcome to Your Blank App" placeholder), `not-found.tsx`. |
| `src/app/` | Contains the **real product code** written by Dyad (auth pages, dashboard, customers, setup-company) — **currently dead code that Next never compiles**. |
| `src/pages/` | Vite/React-Router leftovers (`Index.tsx`, `NotFound.tsx` importing `react-router-dom`). Next treats `src/pages/` as a **Pages Router** directory; `NotFound.tsx` breaks the build (`react-router-dom` is not installed). |
| Vite leftovers | `index.html` (references missing `/src/main.tsx`), `src/vite-env.d.ts`, `src/App.css`, `tsconfig.app.json`, `tsconfig.node.json` (references missing `vite.config.ts`). |
| `eslint.config.js` | Vite-style **flat config** (react-refresh plugin, ignores `dist`). Next 14's `next lint` cannot read flat config → interactive prompt → exit 1. Lint is effectively **unavailable**. |
| `vercel.json` | SPA rewrite `/(.*) → /index.html`. **Wrong for Next.js** and will break routing in production. |
| Duplicate Supabase clients | `lib/supabase.ts` and `src/lib/supabase.ts` are byte-identical (`@supabase/supabase-js`, anon key, `NEXT_PUBLIC_*`). |
| `@/` alias | `tsconfig.json` + `tsconfig.app.json` map `@/*` → `./src/*`. The shadcn kit in `src/components/ui` and `src/lib/utils.ts` resolve through it. |
| `components.json` | Points Tailwind CSS at `src/index.css` (does not exist; the real stylesheet is `src/globals.css`) and sets `"rsc": false`. |
| shadcn/ui | 49 files in `src/components/ui/` — real, usable shadcn components, but **none have `"use client"`** and `calendar.tsx` imports `react-day-picker`, which is not installed. |
| `.next/` | **Committed to git** (57 tracked files) — build output in version control. Not in `.gitignore`. |
| Env | No `.env`, no `.env.example`. `.gitignore` does **not** ignore `.env*`. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are referenced (both in the duplicate client files). |
| `next.config.*` | **Does not exist.** |
| `middleware.ts` | **Does not exist.** |
| Tests / CI | **None.** No test runner, no `.github/workflows`. |
| Database | One file: `supabase/schema.sql`. **No `supabase/migrations/` directory.** The file is not runnable as-is (see §1.3). |
| Auth deps | Code imports `@supabase/auth-helpers-nextjs` and `@supabase/supabase-js`, **neither is in `package.json`**. `@supabase/auth-helpers-nextjs` is deprecated upstream. |
| Fonts | `src/app/layout.tsx` uses `next/font/google` (Inter). Build-time Google Fonts fetch **fails in the sandbox** (`ECONNRESET`) → avoid `next/font/google`; use a system font stack or a local font file. |
| Docs | `README.md` is the Dyad placeholder ("Welcome to your Dyad app"). `AI_RULES.md` is **wrong** for this repo: it mandates React Router, `src/App.tsx` routes, `src/pages/Index.tsx` as main page, and "don't edit shadcn files" — none of which match a Next.js App Router app. |

### 1.2 Verified baseline failures (2026-10-06, before any phase work)

Environment used: Node 22.22.3, pnpm 9.15.9, `pnpm install --frozen-lockfile` (lockfile v9.0).

* `pnpm build` → **FAIL**
  * `./src/pages/NotFound.tsx` — `Module not found: Can't resolve 'react-router-dom'`
  * `./app/layout.tsx` — `Module not found: Can't resolve './globals.css'`
* After deleting root `app/` (so Next uses `src/app/`), `pnpm build` still → **FAIL**
  * `./src/pages/NotFound.tsx` — `react-router-dom` missing
  * `src/app/layout.tsx` — `next/font` fails to fetch `Inter` from Google Fonts
  * `src/app/auth/callback|forgot-password|reset-password/page.tsx` — server/client boundary errors
    ("importing a component that needs `useState`/`useEffect`/`useRouter`/`useSearchParams` … none of its parents are marked with `use client`")
* Modules imported by existing source but **absent from `package.json`** (surfaced by the build log above and by the
  typecheck baseline in the next bullet): `@supabase/supabase-js`, `@supabase/auth-helpers-nextjs`,
  `react-router-dom`, `react-day-picker`.
* `pnpm lint` → **FAIL / NOT AVAILABLE** — `next lint` cannot consume the flat `eslint.config.js` and exits 1 in a non-interactive shell.
* `npx tsc -p tsconfig.json --noEmit` → **FAIL** — TS6305 project-reference errors (broken solution-style config; `tsconfig.json` has `files: []` + references and also glob-includes everything).
* `npx tsc -p tsconfig.app.json --noEmit` → **FAIL — exactly 7 errors** (this is the pre-existing baseline):
  1. `src/app/dashboard/layout.tsx(1,10)` TS2614 — `@/components/Sidebar` has no named export `Sidebar` (it is a default export)
  2. `src/app/dashboard/layout.tsx(2,31)` TS2307 — cannot find `@supabase/auth-helpers-nextjs`
  3. `src/app/layout.tsx(4,34)` TS2307 — cannot find `@supabase/auth-helpers-nextjs`
  4. `src/app/page.tsx(1,10)` TS2614 — `next/image` has no named export `Image`
  5. `src/components/ui/calendar.tsx(3,27)` TS2307 — cannot find `react-day-picker`
  6. `src/lib/supabase.ts(1,30)` TS2307 — cannot find `@supabase/supabase-js`
  7. `src/pages/NotFound.tsx(1,29)` TS2307 — cannot find `react-router-dom`
* `.next/` and `tsconfig.tsbuildinfo` are build artifacts that need to be untracked (running a build currently **dirties the working tree**).

**Rule:** these failures are *pre-existing*. Every phase must report whether a failure is pre-existing or newly introduced (§7.4). Never hide them.

### 1.3 Database audit (`supabase/schema.sql`)

Table names and most columns are **worth keeping** (they match the product spec). The file itself is **not runnable** and its RLS is **not safe** as written:

1. **Invalid order** — `profiles` references `companies` before `companies` is created → the script fails on a fresh project.
2. **Recursive RLS policies** — policies on `company_members` and `companies` query `company_members` from inside their own policy → PostgreSQL error `infinite recursion detected in policy for relation "company_members"` at query time. Tenant isolation is therefore **not usable as written**.
3. **Chicken-and-egg membership** — `company_members` INSERT policy requires the inserter to already be an owner/admin of that company → the first member (the founder) can never be inserted. The existing `setup-company/page.tsx` flow depends on this and is therefore broken by design.
4. **Dual source of truth** — `profiles.company_id` competes with `company_members`. Flows must derive the tenant from `company_members`; `profiles.company_id` may only be a UI convenience pointer.
5. **`profiles` has no INSERT policy and no `auth.users` trigger** → no profile row is ever created automatically.
6. **No `authenticated` grants / no storage setup** — the `documents` bucket is only mentioned in a comment; no bucket, no storage policies.
7. **`documents` and `service_records` have no `company_id`** — ownership is implied through `equipment`, which works but makes policies slower and easier to get wrong (see §8.4).
8. **`reminders` cannot prevent duplicates** — no unique constraint, no `days_before`/`due_date` columns; the enum only distinguishes "Service Due"/"Service Overdue".
9. **`equipment.public_token uuid default uuid_generate_v4()`** — requires the `uuid-ossp` extension. It is unguessable (122 random bits) and non-sequential, so the UUID approach is acceptable, but the migration should use `gen_random_uuid()` (pgcrypto, present on Supabase) and must make the column `NOT NULL UNIQUE`, backfill existing NULLs, and **never regenerate it**.
10. `equipment.service_interval` is in **months**; `companies.default_service_interval` defaults to **12**.

No evidence exists in the repo that this schema was ever applied to a live Supabase project. Phase 1 must ask/verify and write migrations **idempotently** (`create table if not exists`, `drop policy if exists`, `add column if not exists`) so they are safe on both an empty project and a partially-provisioned one (§8.2).

### 1.4 What is worth preserving (do not rebuild)

* The shadcn/ui component kit in `src/components/ui/**` and `src/lib/utils.ts` (`cn`).
* `src/hooks/use-toast.ts`, `src/hooks/use-mobile.tsx`, `src/globals.css` (Tailwind tokens + light/dark CSS variables), `tailwind.config.ts`, `postcss.config.js`.
* The marketing copy and section structure in `src/app/page.tsx` (hero, problem, how-it-works, benefits, pricing, FAQ, CTA) — it is on-message; Phase 8 polishes it.
* The page inventory/shape in `src/app/**` (auth pages, dashboard shell, customers list/new, setup-company) — treat as a starting point, not as a specification.
* Table/column naming from `supabase/schema.sql` (with the fixes in §8).
* Existing `equipment_type`, `equipment_status`, `service_type`, `document_type`, `document_visibility`, `reminder_type`, `reminder_status`, `subscription_plan`, `subscription_status` enums — their values match the product spec.

### 1.5 What is obsolete (safe to delete, Phase 1 does it)

`app/` (root, 3 files) · `lib/supabase.ts` (root duplicate) · `src/pages/` · `index.html` · `src/App.css` ·
`src/vite-env.d.ts` · `tsconfig.app.json` · `tsconfig.node.json` · `src/components/made-with-dyad.tsx` ·
`vercel.json` (SPA rewrite) · the flat `eslint.config.js` (replaced) · tracked `.next/**` and
`tsconfig.tsbuildinfo` (untrack + gitignore) · `supabase/schema.sql` (move to a clearly-named legacy file,
migrations become authoritative) · `AI_RULES.md` content (rewrite to match reality) · the dead product routes that
Phase 1 cannot support yet (`src/app/dashboard/customers/**`, the equipment-stats body of
`src/app/dashboard/page.tsx`, `src/auth.ts`'s browser-only sign-out) — Phase 2/3 rebuild customers and equipment
properly; the old markup stays in git history as a shape reference.

---

## 2. Target architecture and canonical structure (Phase 1 decides, then it is frozen)

**Stack (already in place, keep it):** TypeScript · React 19.2.3 (pinned by the lockfile) · Next.js 14.2.35 App Router ·
Tailwind CSS 3.4 · shadcn/ui · pnpm 9 (lockfile v9.0) · Node 22 · Vercel-compatible.

**Do NOT migrate frameworks.** Next.js is viable once the Vite/Dyad leftovers are removed. Do not introduce
React Router, do not switch to Vite, do not migrate Tailwind to v4, do not upgrade Next to v15 in these phases.

**Recommended canonical structure** (Phase 1 verifies, then documents the final answer in the repo `README.md`):

```
src/
  app/                     # App Router (canonical — root app/ is deleted, Next then resolves src/app)
    layout.tsx             # server layout: fonts (no Google fetch), metadata, providers, globals.css
    page.tsx               # landing page (public) — polished in Phase 8
    globals.css            # optional: may re-export/move src/globals.css
    (auth)/                # not required; /auth/* paths are fine as-is
    auth/…                 # sign-in, sign-up, forgot-password, reset-password, check-email, callback/route.ts
    dashboard/…            # protected shell: layout.tsx does a server-side session check
    p/[token]/page.tsx     # public UnitPass (Phase 3) — no auth, noindex
    api/…                  # route handlers (auth callback, cron, webhooks — later phases)
  components/
    ui/…                   # shadcn kit (keep)
    …                      # app components (Sidebar, forms, etc.)
  lib/
    supabase/              # client.ts (browser), server.ts (server), middleware.ts helper, admin.ts (later phases)
    utils.ts
  hooks/
  globals.css
supabase/
  migrations/              # AUTHORITATIVE, timestamped, idempotent DDL
  legacy/schema.sql.txt    # retired original file, reference only
  tests/                   # runnable SQL test scripts (RLS/tenant isolation + phase scenarios)
middleware.ts              # at repo root OR src/middleware.ts (pick one, document it)
.env.example               # every variable name, no real values
prompts/                   # this playbook
```

**Phase 1 decision rule:** pick the structure that deletes/reuses the most existing code and moves the fewest
files. The recommended answer is: **delete root `app/`, keep `src/app`** (the product code and the `@/*` alias
already live in `src/`). If the agent finds a concrete blocking reason to do the opposite, it must say so in the
completion report and record the final decision in the repo `README.md`.

**Conventions to standardise in Phase 1 and then follow forever:**

* Writes happen in **Server Actions** (or route handlers) that derive `company_id` from the server-side session.
  Never accept `company_id` from a form field or client state for authorization. RLS is the backstop, not the plan.
* Reads for the dashboard happen in Server Components (server Supabase client) where practical; client components
  only for interactivity.
* Supabase clients: `@supabase/ssr` (`createBrowserClient` / `createServerClient` with cookies).
  **Do not** install the deprecated `@supabase/auth-helpers-nextjs`.
* Service-role key: server-only, in one module (`src/lib/supabase/admin.ts` + `import 'server-only'`), created in the
  first phase that needs it (documents/reminders/billing). Never import it into a client component.
* Package manager: **pnpm** (`packageManager: "pnpm@9.15.9"`). Commit the lockfile. Do not add `package-lock.json`.

---

## 3. Global product rules (apply to EVERY phase)

1. Inspect before modifying.
2. Preserve working functionality.
3. Do not rewrite working components merely for stylistic preference.
4. Do not implement features belonging to future phases.
5. Avoid unnecessary dependencies.
6. Never commit secrets.
7. Never expose Supabase service-role credentials client-side.
8. Enforce tenant isolation server-side/database-side.
9. Use Supabase Row Level Security where applicable.
10. Never trust `company_id` supplied by the browser for authorization.
11. Public equipment passports must use secure non-sequential public identifiers/tokens.
12. Private notes and private documents must NEVER be exposed through public UnitPass pages.
13. Mobile responsiveness is mandatory.
14. Prefer simple maintainable solutions over sophisticated architecture.
15. Do not create native mobile apps.
16. Do not create AI features for MVP.
17. Do not create a full CRM.
18. Do not create accounting functionality.
19. Do not create inventory management.
20. Do not create technician dispatching.
21. Do not create route planning.
22. Do not create SMS functionality.
23. Do not create homeowner payments.
24. Do not create complicated appointment scheduling.
25. Do not add features merely because they might be useful.

Product context (keeps decisions grounded): HVAC companies create a digital record per installed unit, each unit
gets a permanent QR code, homeowners scan it to see warranty/equipment/service information and book service, and
the company is reminded when service is due. Long-term the model should generalise beyond HVAC, but V1 is
HVAC-focused. Optimise for shipping fast with limited resources.

---

## 4. Git workflow (mandatory)

### 4.1 Branches

* Integration branch: **`main`**. The human owner merges. Agents never merge.
* One branch per phase, created **from the latest `main`**:

| Phase | Branch |
|---|---|
| 1 | `phase/01-foundation` |
| 2 | `phase/02-customers` |
| 3 | `phase/03-unitpass-qr` |
| 4 | `phase/04-service-history` |
| 5 | `phase/05-documents` |
| 6 | `phase/06-reminders` |
| 7 | `phase/07-billing` |
| 8 | `phase/08-production` |

### 4.2 At the start of every phase

```bash
git status                     # 1. confirm working tree status (stop and report if dirty/unexplained)
git branch --show-current      # 2. confirm current branch
git fetch origin --prune       # 3. fetch latest if remote access is available
git checkout main
git pull --ff-only origin main # 4. start from the latest main
git log --oneline -5           #    record what you are basing the work on
git checkout -b phase/0N-<name> # 6. create the phase branch from main
git push -u origin phase/0N-<name>   # 7. publish it (or report the exact command the owner must run)
```

### 4.3 Hard rules

* **NEVER** base a new phase branch on an unmerged previous phase branch.
* **NEVER** delete a phase branch (local or remote).
* **NEVER** merge, rebase-onto-main, or push to `main`.
* **NEVER** force-push a phase branch.
* Keep commits focused; use clear conventional messages (`feat:`, `fix:`, `chore:`, `docs:`, `test:`).
* Do not commit build output, `node_modules`, `.next`, `.env*`, or generated artifacts.

### 4.4 If branch creation or push is unavailable

Say so explicitly and give the owner the exact commands, e.g.:

```
git fetch origin --prune
git checkout main && git pull --ff-only origin main
git checkout -b phase/01-foundation
git push -u origin phase/01-foundation
```

Work locally on the branch if local creation works, and state in the completion report:
"BRANCH NOT PUSHED — owner must run `<command>`". **Never pretend a push happened.**

### 4.5 Verify previous phases before starting (the owner controls merging)

```
main
 ↓
phase/01-foundation → owner reviews → owner merges into main (only if SAFE TO MERGE = YES)
 ↓
NEW agent session → phase/02-customers created from the updated main → repeat
```

At the start of phase N (N > 1), prove the prerequisites are actually in `main`:

```bash
git checkout main && git pull --ff-only origin main
git log --oneline --grep="phase" -20
ls supabase/migrations            # the phase's migration files must exist
ls src/app/dashboard              # the phase's routes must exist
```

If a prerequisite phase is missing from `main`, **stop** and report it. Do not silently re-implement it and do
not build on top of an unmerged branch.

---

## 5. Phase anatomy (every phase file contains these sections)

Objective · Preconditions/branch setup · Scope · Explicit exclusions · Implementation requirements ·
Database/migration requirements · Security requirements · Acceptance criteria · Tests & verification ·
Environment variables & external services · Files expected to change · Deferred/notes · Phase completion report ·
Stop conditions.

---

## 6. PHASE COMPLETION REPORT (mandatory, verbatim structure)

Every phase ends with this report as the final message. Copy this block and fill it in:

```
PHASE:
BRANCH:
IMPLEMENTED:
FILES CHANGED:
DATABASE CHANGES:
DEPENDENCIES ADDED:
ENVIRONMENT VARIABLES REQUIRED:
TESTS RUN:
BUILD STATUS: PASS / FAIL
LINT STATUS: PASS / FAIL / NOT AVAILABLE
TYPE CHECK: PASS / FAIL
SECURITY CHECK: PASS / FAIL / UNVERIFIED
KNOWN ISSUES:
MANUAL TESTS REQUIRED:
FUTURE PHASE NOTES:
SAFE TO MERGE: YES / NO
MERGE REASON:
```

Field rules:

* **PHASE** — number and name. **BRANCH** — the exact expected branch name (and whether it was pushed).
* **FILES CHANGED** — important files only (not every file); mention deletions.
* **DATABASE CHANGES** — each migration file, tables/columns/policies/functions/buckets touched, and whether it was
  **applied** or only authored.
* **DEPENDENCIES ADDED** — list or "None". **ENVIRONMENT VARIABLES REQUIRED** — list or "None".
* **TESTS RUN** — the exact commands and what they returned (not "looks correct").
* **BUILD/LINT/TYPE CHECK** — real status. `LINT STATUS: NOT AVAILABLE` is acceptable only if the script is broken
  for pre-existing reasons and that is explained.
* **SECURITY CHECK** — tenant-isolation / public-exposure checks. Use `UNVERIFIED` (with the reason and the exact
  commands the owner must run) when credentials are unavailable — never claim PASS without evidence.
* **KNOWN ISSUES** — anything unresolved, including pre-existing issues you did not fix.
* **MANUAL TESTS REQUIRED** — click-by-click things the owner must verify.
* **FUTURE PHASE NOTES** — what was intentionally deferred and why.

**`SAFE TO MERGE: YES` is forbidden if any of these are true:**

* the production build fails;
* TypeScript has relevant errors;
* migrations are broken or unverified in a way that would corrupt data;
* tenant isolation is known (or plausibly) insecure;
* private information is publicly exposed;
* required functionality for the phase is incomplete;
* critical tests fail.

When in doubt: report `NO` and state exactly what must happen to turn it into a `YES`.

---

## 7. Testing and verification philosophy

### 7.1 There is no test framework in this repo (and phases must not add a big one)

Phase 1 fixes the tooling so these commands exist and work:

```bash
pnpm install --frozen-lockfile
pnpm typecheck     # tsc --noEmit
pnpm lint          # next lint (or eslint . — whatever Phase 1 establishes and documents)
pnpm build         # next build
pnpm dev           # local dev server
```

Per-phase verification uses:

1. **Static gates** — `pnpm typecheck`, `pnpm lint`, `pnpm build`. All three must pass at the end of a phase
   (or be explained as pre-existing and unchanged).
2. **SQL/RLS tests** — committed SQL scripts under `supabase/tests/`, run by the agent when DB access exists and by
   the owner otherwise. RLS is a *database* behaviour: test it in the database, not with a JS test framework.
3. **Manual, scripted verification** — exact routes/steps the agent (or owner) performs, plus `curl`/`grep` checks
   where possible (for example: unauthenticated `/dashboard` must redirect; rendered public HTML must not contain a
   private value that the agent deliberately seeded).
4. **Focused, purpose-built checks** — a documented `curl`, a temporary local script, or a SQL assertion is fine and
   preferred over installing Jest/Vitest/Playwright. Do not add a test framework before Phase 8 unless the phase file
   explicitly allows it.

### 7.2 RLS test pattern (supabase/tests)

Canonical file: `supabase/tests/rls_tenant_isolation.sql` (Phase 1 creates it; later phases **append** scenario
sections marked with the phase number). Structure:

```sql
-- Run with: psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
begin;
-- Fixtures (as superuser/service role): two companies, two users, one row each.
-- Impersonate Company A's user:
set local role authenticated;
set local request.jwt.claims = '{"sub":"<user-a-uuid>","role":"authenticated"}';
-- Assertions: A sees its own row, A sees zero of B's rows, A cannot insert/update for B, etc.
-- Use do $$ ... if (...) then raise exception 'FAIL: ...'; end if; ... $$;
rollback;  -- never persist test data
```

Rules: fixtures are created inside a transaction that is **rolled back**; assertions raise exceptions on failure
(non-zero exit = fail); never run against production data with real customer rows; never leave test rows behind.

### 7.3 When credentials are unavailable

This is expected: the agent may not have Supabase/Stripe/Resend credentials. Then:

* Do **not** invent/fake secrets or commit placeholder keys that look real.
* Write the migrations, tests and code anyway, and add the variable names to `.env.example`.
* Report `SECURITY CHECK: UNVERIFIED` and `SAFE TO MERGE: NO` with the exact owner actions required
  (e.g. "run `psql "$SUPABASE_DB_URL" -f supabase/tests/rls_tenant_isolation.sql`, expect `COMMIT`/no exceptions").
* Never claim a runtime behaviour was verified when it could not be executed.

### 7.4 Distinguish pre-existing from new failures

Baseline (see §1.2) is **broken**: build fails, lint unavailable, typecheck has 7 errors. Every report must say
whether each observed failure is **pre-existing** or **newly introduced**. Never "fix" a report by hiding it.
Reducing the baseline is expected as phases land.

### 7.5 Migration safety

* Migrations live in `supabase/migrations/`, timestamped (`YYYYMMDDHHMMSS_phaseN_description.sql`), **idempotent**,
  and committed with the code that needs them.
* **Never** destructively edit a migration that may already be applied to a live project. Add a new migration.
* **Never** `drop table` / `drop column` / `truncate` / delete customer data as part of a phase. Before any
  potentially destructive change: stop, report the risk, and propose it as an owner-approved follow-up.
* Column/enum additions are safe; `alter type ... add value` is safe (must be in its own migration if the value is
  used immediately in the same transaction — Supabase runs migrations in a transaction, so add the value, then use it
  in a later migration or via `commit`).
* Do not delete user/customer data to make development easier. Soft-delete (`archived_at`) where the product needs it.
* Enable RLS on every new tenant-owned table in the same migration that creates it.

---

## 8. Database conventions

### 8.1 Target relational model (keep the existing names)

| Table | Ownership | Introduced |
|---|---|---|
| `profiles` | 1:1 with `auth.users` | Phase 1 |
| `companies` | tenant root | Phase 1 (extra profile columns in Phase 2) |
| `company_members` | user ↔ company + role (`owner`/`admin`/`technician`) | Phase 1 |
| `customers` | `company_id` | Phase 2 |
| `equipment` | `company_id` + `customer_id`, `public_token` | Phase 3 (+ created in Phase 1 only if needed by tests — expected: Phase 3) |
| `service_records` | `company_id` + `equipment_id` | Phase 4 |
| `documents` | `company_id` + `equipment_id` + `storage_path` + `visibility` | Phase 5 |
| `reminders` | `company_id` + `equipment_id` + `days_before` + `due_date` | Phase 6 |
| `subscriptions` | `company_id` + Stripe ids | Phase 7 |

Inspect `supabase/migrations/` **before** creating anything: if a table already exists, `alter table` it
(non-destructively) instead of creating a duplicate. UUID primary keys (`gen_random_uuid()`), `created_at`/`updated_at`
timestamps with a shared `set_updated_at()` trigger, indexes on every foreign key and on the columns the UI filters
(`company_id`, `next_service_date`, `status`, `public_token`).

### 8.2 Idempotency and partial existing installs

Because `supabase/schema.sql` may or may not have been applied to the owner's Supabase project, Phase 1's migration
must be written to be safe in both worlds:

```sql
create extension if not exists pgcrypto;
create table if not exists public.companies ( ... );
alter table public.companies add column if not exists service_booking_url text;
alter table public.companies enable row level security;
drop policy if exists "members can read their company" on public.companies;
create policy "members can read their company" on public.companies for select using (public.is_company_member(id));
```

If the agent has DB access and finds a **different** shape than expected, it must reconcile non-destructively,
document the discrepancy in the report, and never drop existing data.

### 8.3 RLS helper functions (the anti-recursion pattern)

Policies must never query a table whose own policy queries the table back. Use `SECURITY DEFINER` helpers with a
frozen `search_path`:

```sql
create or replace function public.is_company_member(target_company uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = target_company
      and m.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_company_member(uuid) from public;
grant execute on function public.is_company_member(uuid) to authenticated;
```

Then every tenant policy is a one-liner, e.g.
`using (public.is_company_member(company_id))` / `with check (public.is_company_member(company_id))`.
Add `public.current_company_ids()` (returns `setof uuid`) if a policy needs the set form.

### 8.4 Denormalised `company_id` on child tables

For `service_records` (Phase 4) and `documents` (Phase 5), add a `company_id uuid not null` column and keep it
consistent with the parent equipment via a `before insert or update` trigger that **overwrites** any
client-supplied value from `equipment.company_id`. This makes policies simple/fast and makes
client-supplied `company_id` harmless — required by global rule 10.

### 8.5 Membership source of truth

`company_members` is authoritative. `profiles.company_id` is a UI convenience pointer only (which company to open on
login). Never use it for authorization; never rely on it existing. Company creation must be atomic via a
`SECURITY DEFINER` RPC (e.g. `public.create_company_with_owner(...)`) that inserts the company and the founder's
`company_members` row in one transaction (using `auth.uid()` internally), so no client can create an orphan company or
grant itself membership of someone else's company.

---

## 9. Security invariants (repeated in every relevant phase file)

1. **Tenant isolation** — enforced by RLS on every tenant table; the app additionally scopes queries by the session's
   company. Company A must never read/write Company B rows, even with a forged request body.
2. **Never trust `company_id` from the browser** — writes derive it server-side; DB triggers/policies verify it.
3. **Public UnitPass is a strict whitelist** — reachable only through an unguessable token (`equipment.public_token`),
   served by a `SECURITY DEFINER` function (e.g. `public.get_public_unitpass(token)`) that returns **only** approved
   public fields. Never `select *` and hide fields in CSS/JS. Tokens never change once printed.
4. **Never expose through public pages**: internal database IDs, `installer_notes`, private service notes, private
   documents, customer/homeowner PII (name, email, phone, postal address), tenant internals, reminder/delivery data,
   subscription/billing data.
5. **Storage** — buckets are private by default; public access to a document only via a server-side validated,
   short-lived signed URL after checking `visibility = 'Public'` **and** that the document belongs to the equipment
   identified by the scanned token. Validate MIME type and size on upload and at the bucket level.
   *Intentional exception:* a **public-read** bucket is acceptable only for non-sensitive marketing/branding assets
   (company logos in `company-assets`). Equipment photos and documents must stay private + signed.
6. **Secrets** — `.env*` is gitignored; only names live in `.env.example`. Service-role/Stripe/Resend keys are
   server-only (`import 'server-only'`).
7. **Billing state is never trusted from the client** — subscription status is read from the DB (written by verified
   webhooks) or fetched server-side from Stripe.
8. **Webhooks are verified** — Stripe signatures verified on the raw body; cron endpoints require a secret header.
9. **Public pages keep working regardless of billing state** — never break a homeowner's printed QR code because a
   subscription lapsed. Billing restricts *new* records, not public reads.

---

## 10. Environment variables (registry)

Add every variable a phase needs to **`.env.example`** (names only) with a short comment, and document setup in the
repo `README.md`. Never commit real values.

| Variable | Scope | Purpose | First needed |
|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | canonical origin for auth redirects, QR payloads, links (e.g. `http://localhost:3000`) | Phase 1 |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL | Phase 1 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Supabase anon key (RLS-protected) | Phase 1 |
| `SUPABASE_DB_URL` | server/dev | Postgres connection string for migration/RLS test scripts | Phase 1 |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | admin tasks: signed URLs, cron, webhooks | Phase 3 (create the admin client only when first needed) |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | **server only** | reminder emails | Phase 6 |
| `CRON_SECRET` | **server only** | authenticates `/api/cron/*` | Phase 6 |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | **server only** | billing + webhook verification | Phase 7 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | public | only if client-side Stripe.js is actually used | Phase 7 (optional) |
| `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PRO` | server (build-time ok) | plan → Stripe price id mapping (config-driven, never hardcode prices in components) | Phase 7 |

---

## 11. UI principles

* shadcn/ui + Tailwind only. Use the existing kit (`src/components/ui/**`); add missing shadcn components with the CLI
  only when a phase needs them, and add `"use client"` where hooks/context are used.
* Style: clean, modern B2B SaaS, professional, generous whitespace, responsive, accessible. Avoid unnecessary
  animation, excessive gradients, glassmorphism, visual clutter, giant decorative components.
* Mobile responsiveness is mandatory in every phase (test at ~375 px width).
* Empty states, loading states and error states are part of "done" for any list or form.
* Dashboard navigation grows phase by phase — **only expose navigation for functionality that actually exists**:

| Nav item | Available from |
|---|---|
| Dashboard | Phase 1 |
| Settings (company profile) | Phase 2 |
| Customers | Phase 2 |
| Equipment | Phase 3 |
| Services | Phase 4 |
| Documents | Phase 5 |
| Billing | Phase 7 |

(Nav labels not yet implemented must not be rendered; the trimmed `Sidebar` in Phase 1 keeps only Dashboard + Sign out,
plus Settings/Customers once Phase 2 lands, etc.)

* Copy and positioning (Phase 8 owns the final wording): **UnitPass — "The Digital Service Passport for HVAC
  Equipment."** / "Turn Every Installation Into Repeat Service Revenue." / 5-step explanation: add equipment → generate
  QR → attach QR to system → customer scans for warranty/service info → HVAC company knows when service is due.

---

## 12. External services

| Service | Used for | Owner configuration required |
|---|---|---|
| Supabase (Postgres, Auth, Storage) | everything | project creation, URL + anon key, applying migrations, storage buckets, email templates |
| Vercel | hosting, cron | project link, env vars, cron enabled |
| Stripe | billing | products/prices, portal settings, webhook endpoint + secret |
| Resend | reminder email | API key, verified sending domain (or `onboarding@resend.dev` for testing) |

When credentials are unavailable, implement the integration safely behind config, add the names to `.env.example`,
document the setup step, and state plainly in the report which functionality **cannot be verified until the owner
configures it**.

---

## 13. Cost control (this project runs on limited agent credits)

Optimise every phase for efficient execution. Avoid: unnecessary refactoring, speculative features, large amounts of
unused generated code, replacing libraries without necessity, rewriting working UI, implementing future-phase
features, and polishing invisible architecture that adds no MVP value. Prefer the smallest change that satisfies the
phase's acceptance criteria, and say "deferred to Phase N" instead of building it.

---

## 14. Decisions log (append-only — each phase adds an entry)

| Date | Phase | Decision | Rationale |
|---|---|---|---|
| 2026-10-06 | (pre-1) | Playbook created; canonical app dir recommended as `src/app` with root `app/` deleted | root `app/` holds 3 placeholder/broken files; all product code + the `@/*` alias live in `src/`; Next falls back to `src/app` once root `app/` is gone |
| 2026-10-06 | (pre-1) | Playbook records Vue-free, no-framework-migration stance: Next 14 App Router + Tailwind 3 + shadcn + pnpm 9 | avoids churn, matches installed dependencies |
| 2026-10-06 | (pre-1) | Playbook requires all writes via Server Actions with server-derived `company_id` | satisfies rule 10 without client trust; simpler than duplicating checks client-side |
| 2026-10-07 | 1 | Canonical app dir = **`src/app`**; root `app/`, `src/pages/`, all Vite/Dyad leftovers deleted; `src/app` fixed in place | zero product files moved; `@/*` alias, shadcn kit and product pages already under `src/` |
| 2026-10-07 | 1 | Supabase clients via `@supabase/ssr` (`createBrowserClient` / `createServerClient`); `@supabase/auth-helpers-nextjs` rejected | deprecated upstream; ssr package is the supported cookie/PKCE flow |
| 2026-10-07 | 1 | Env checks are **lazy** (inside client factories), not module-level | module-level throw would make `next build` depend on credentials; runtime still fails fast and names the missing variable |
| 2026-10-07 | 1 | Tenancy source of truth = `company_members`; `profiles.company_id` is a UI pointer only | matches global rule 10; the legacy schema conflated the two |
| 2026-10-07 | 1 | RLS predicates use `SECURITY DEFINER` helpers (`is_company_member` / `is_company_admin`) with `set search_path = ''` | fixes the legacy "infinite recursion detected in policy for company_members" bug |
| 2026-10-07 | 1 | Companies are created **only** through `public.create_company_with_owner()`; no INSERT policy on `companies` | prevents arbitrary-company creation and self-granted membership |
| 2026-10-07 | 1 | Session gate exists twice: `middleware.ts` (refresh + `/dashboard` guard) and the server-side dashboard layout (`requireUser()`) | defence in depth; layout also handles the "signed in but no company" case via `requireCompany()` |
| 2026-10-07 | 1 | ESLint moved from the Vite flat config to `.eslintrc.json` (`next/core-web-vitals`) with ESLint 8 + `eslint-config-next@14.2.35` | `next lint` could not read the flat config at all (lint was unavailable in the baseline) |
| 2026-10-07 | 1 | `postcss.config.js` converted to CommonJS | ESM `export default` in a CJS package broke the Tailwind pipeline (`must export a plugins key`) |
| 2026-10-07 | 1 | Root `app/`… Vite leftovers removed; `.next/**` and `*.tsbuildinfo` untracked and gitignored; legacy schema moved to `supabase/legacy/schema.sql.txt` | baseline hygiene; migrations are authoritative |
| 2026-10-07 | 1 | Added `supabase/tests/local/postgres_shim.sql` so the RLS suite can run on a plain Postgres without Supabase credentials | makes the security tests reproducible offline; the canonical path stays `psql "$SUPABASE_DB_URL"` |
| 2026-10-07 | 1 | Unused shadcn components kept; unused deps left for Phase 8 | cost control: no rewrites/removals without evidence of benefit |

Future phases: add a row per decision that changes architecture, dependencies, schema, or security posture.

---

## Appendix A — quick command reference

```bash
# setup
corepack enable --install-directory /usr/local/bin pnpm    # if pnpm is missing; use pnpm@9.15.9
pnpm install --frozen-lockfile

# gates
pnpm typecheck && pnpm lint && pnpm build

# run locally
pnpm dev    # http://localhost:3000

# migrations / tests (when DB credentials exist)
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql

# verify RLS is enabled on every public table
psql "$SUPABASE_DB_URL" -c "select relname, relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by 1;"

# git (phase start)
git fetch origin --prune && git checkout main && git pull --ff-only origin main
git checkout -b phase/0N-<name> && git push -u origin phase/0N-<name>
```
