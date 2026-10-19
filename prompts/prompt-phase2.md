# PHASE 2 — Company Onboarding and Customers

**Branch:** `phase/02-customers` (create from the latest `main` — **verify Phase 1 is merged into `main` first**)
**Prerequisites:** Phase 1 (`phase/01-foundation`) merged into `main`. /prompts/README.md read in full.
**Depends on:** Phase 1 (auth, companies, `company_members`, RLS helpers, dashboard shell).
**Blocks:** Phase 3 (equipment belongs to customers).

---

## 1. Objective

Make a new HVAC company productive without any equipment yet: a real company profile (with service booking URL and a
default service interval) and complete customer management (create, view, edit, search, archive) — all strictly
tenant-isolated — plus a dashboard that finally shows meaningful company/customer information.

This is the "office can start using it" phase: a company can enter its customers today, so that Phase 3 can attach
equipment to them.

---

## 2. Preconditions and branch setup

```bash
git status                        # must be clean
git fetch origin --prune
git checkout main
git pull --ff-only origin main
git log --oneline -10             # confirm the Phase 1 work is present in main
ls src/lib/supabase               # Phase 1 clients must exist
ls supabase/migrations            # Phase 1 migration must exist
git checkout -b phase/02-customers
git push -u origin phase/02-customers

pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm build    # baseline must be green before you change anything
```

If Phase 1 is **not** in `main`: stop and report. Do not implement Phase 1 here and do not branch off
`phase/01-foundation`.

Re-read `/prompts/README.md` §3 (global rules), §8 (database conventions), §9 (security invariants), §11 (UI/nav map).

---

## 3. Scope

### 3.1 Company profile (Settings)

* Add `/dashboard/settings` with a **company profile form**: company name, contact name, phone, email, website,
  address, **service booking URL**, **default service interval (months, default 12)**.
* Save via a **Server Action** that (a) reads the session server-side, (b) determines the user's company from
  `company_members` (never from the form), (c) updates only that company. RLS must reject cross-tenant updates as a
  backstop; do not rely on the client.
* Validation: required `name`; `default_service_interval` integer 1–60 (default 12); email shape if provided; website
  and service booking URL must be http(s) URLs if provided (normalise by trimming whitespace).
* Show success/error feedback (shadcn + `sonner` toast or inline alert) and disable the submit button while pending.
* Add the nav entry **Settings** (see §11 nav rules in the README) — only after the page exists.

**Logo (optional in this phase — decide and document):** if the storage foundation can be added cheaply, implement it;
otherwise defer to Phase 5 and state that in `FUTURE PHASE NOTES`. If implemented:
* bucket `company-assets` (**public read**, member write), upload path `{company_id}/logo-{timestamp}.{ext}`;
* ≤ 2 MB, MIME allowlist `image/png`, `image/jpeg`, `image/webp`, `image/svg+xml` (or exclude SVG if you cannot
  sanitise it);
* storage policies must be scoped to the member's company prefix
  (`(storage.foldername(name))[1] = (select company_id::text from ... )` — mirror the pattern in `/prompts/README.md` §8.3);
* store the resulting URL in `companies.logo_url`. Never let a user write into another company's prefix.

### 3.2 Customer management

Customer fields (match the existing `customers` table naming): `first_name`, `last_name`, `email`, `phone`,
`address`, `city`, `state` (state/province), `postal_code`, `country`, plus `company_id`, `archived_at`,
`created_at`, `updated_at`.

Routes and behaviour:

| Route | Purpose |
|---|---|
| `/dashboard/customers` | List + search + filter + pagination + "Add customer" |
| `/dashboard/customers/new` | Create form |
| `/dashboard/customers/[id]` | Customer detail (details, contact links, archived state; **placeholder for equipment** with a clear "coming next" empty state — do not build equipment) |
| `/dashboard/customers/[id]/edit` | Edit form |
| archive/unarchive | Server Action from the list and detail pages |

Requirements:

* **Create / edit** via Server Actions with server-side validation (`zod` is already a dependency — use it, and return
  field-level errors; do not add another form library). Derive `company_id` from the session; **never** accept it from
  the form.
* **List**: search across first name, last name, email and phone (case-insensitive `ilike`), active-only by default,
  with an "include archived" filter, ordered by last name (`nulls last`) then first name. Show name, email, phone,
  city/state, and a status chip for archived.
* **Pagination**: keep it trivial — page-based (`?page=`), 25 per row set, using Supabase `range()`. Do not add a data
  table library.
* **View**: readable detail card with clickable `mailto:`/`tel:`, address block, created date, archived banner,
  Edit / Archive / Unarchive actions.
* **Archive**, do not delete: `archived_at timestamptz` (soft delete). Archived customers are hidden from the default
  list and excluded from active counts, but keep their data. Do **not** implement hard delete or cascade deletion.
* **Empty / loading / error states** for list, detail and forms (with `loading.tsx`/`error.tsx` or inline states).
* Mobile: list is card-based (single column) below `md`; forms are single column on phones; tap targets ≥ 40 px.
* Currency-free, no CRM features: no tags, segments, lead stages, notes timelines, attachments, emails from the app,
  activities, bulk import/export, dedupe engine, or customer portal.

### 3.3 Dashboard

Replace the Phase 1 placeholder dashboard with something genuinely useful:

* Summary cards: **total active customers**, **new customers this month**, **archived customers**, and (if trivially
  cheap) **company profile completeness** (e.g. missing phone/email/service booking URL). **No equipment/service/QR
  cards yet** — those tables do not exist until Phase 3/4.
* "Recent customers" list (latest 5, linking to detail).
* "Your company" card showing the profile fields with a link to Settings.
* An onboarding hint: "Next: add equipment (available in a later release)" is acceptable as plain text, but do not
  render controls for features that do not exist.
* All counts are tenant-scoped (server-side query filtered by the session's company **and** protected by RLS).

---

## 4. Explicit exclusions

Equipment, equipment types/status, QR codes, public UnitPass pages, service records/history, reminders, email
sending, documents/storage beyond the optional company logo, Stripe/billing/limits, team invites, customer CSV
import/export, customer portal, quotes/estimates, scheduling, notes/activity feeds, tags/segments, mailing lists,
SMS, AI features, native apps, and any marketing copy work (Phase 8).

---

## 5. Database and migration requirements

Add a new idempotent migration, e.g. `supabase/migrations/20261015000001_phase2_customers.sql`:

1. `companies` (alter, non-destructive):
   * `add column if not exists service_booking_url text;`
   * (logo work, if implemented, uses the existing `logo_url` column — no change needed.)
2. `customers` — `create table if not exists public.customers` with the columns in §3.2, `company_id uuid not null
   references public.companies(id) on delete cascade`, `id uuid primary key default gen_random_uuid()`,
   `archived_at timestamptz`, timestamps, `set_updated_at` trigger.
   * If the table already exists (legacy script applied) → **only** `add column if not exists` for the new columns
     (`archived_at`), keep existing data, do not drop/rename anything.
3. Indexes: `customers(company_id, archived_at)`, `customers(company_id, lower(last_name), lower(first_name))`,
   and (cheap, helps search) `customers(company_id, lower(email))`.
4. RLS: `alter table public.customers enable row level security;` then
   * `select` using `public.is_company_member(company_id)`,
   * `insert` with check `public.is_company_member(company_id)`,
   * `update` using `public.is_company_member(company_id)` with check `public.is_company_member(company_id)`,
   * `delete` using `public.is_company_member(company_id)` **but the app must never hard-delete** (keep the policy so a
     future explicit purge path is possible, and note this in the report).
   * `revoke all on public.customers from anon;` and grant to `authenticated`.
5. If you implement the company logo bucket, include its `storage.buckets` row and storage policies in the migration
   (idempotent: `insert ... on conflict (id) do nothing`, `drop policy if exists` before creating storage policies).
   If the SQL for `storage.*` cannot be run with your credentials, say so and document the dashboard steps instead.

Append a Phase 2 section to `supabase/tests/rls_tenant_isolation.sql` covering: A cannot select/update/archive B's
customers; A's customer insert with B's `company_id` fails (`with check` violation); A's search only returns A's rows;
archived rows remain visible to their own company only.

---

## 6. Security requirements

1. `company_id` is always derived server-side from the session's membership; a forged form field must be irrelevant
   (prove it in the SQL test with a cross-tenant insert attempt).
2. Search/sort/pagination parameters are validated (integer page ≥ 1, string length limits) and always combined with
   the tenant filter — never build raw SQL from user input.
3. RLS enabled on `customers`; the Phase 2 test section passes (or is reported `UNVERIFIED` with the owner command).
4. No customer data is exposed on any public route (there are no public routes yet).
5. Archived ≠ visible: archived customers are excluded from default lists and active counts.
6. No service-role key in client code; server actions use the cookie-bound server client (or the admin client only for
   storage bucket provisioning during setup, never for user-initiated data access).
7. `.env*` remains untracked; any new variable names go into `.env.example`.

---

## 7. Acceptance criteria

* [ ] `pnpm typecheck && pnpm lint && pnpm build` all pass; no new console errors on the touched routes.
* [ ] Settings page updates the company profile (including service booking URL and default interval) and the changes
      persist after reload; a second company cannot change the first company's profile.
* [ ] Customers: create, view, edit, search, archive, unarchive — all work with validation errors shown inline.
* [ ] Search matches partial first/last name, email and phone, case-insensitively, and returns only the signed-in
      company's customers.
* [ ] Archived customers disappear from the default list and counts; they still exist in the database; unarchive
      restores them.
* [ ] Dashboard cards and recent customers are correct and tenant-scoped (verified with two accounts).
* [ ] Empty states exist for zero customers and invalid customer id (`notFound()`), and error/loading states exist for
      the list and detail routes.
* [ ] Navigation shows Dashboard, Customers, Settings only (plus sign-out); nothing for equipment/services/documents/billing.
* [ ] Usable at 375 px; no horizontal scrolling; forms are thumb-friendly.
* [ ] `supabase/tests/rls_tenant_isolation.sql` (Phase 1 + Phase 2 sections) passes, or is reported `UNVERIFIED` with
      the exact owner command.
* [ ] No future-phase functionality was implemented.

---

## 8. Tests and verification

```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm dev
curl -sI http://localhost:3000/dashboard/customers | head -5     # unauthenticated → redirect to /auth/sign-in
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<phase2>.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
```

Manual matrix (record pass/fail; do the isolation rows with two accounts if a Supabase project is configured):

| # | Test | Expected |
|---|---|---|
| 1 | Create customer with all fields | appears in the list with correct data |
| 2 | Create customer with only names | succeeds; optional fields blank, no crash |
| 3 | Edit a customer, reload | changes persist |
| 4 | Search by partial last name / email / phone | correct single result, case-insensitive |
| 5 | Search term with `%` or `_` inside | treated literally, no cross-tenant or wildcard surprises |
| 6 | Archive a customer | disappears from default list/counts; still in DB; unarchive restores |
| 7 | Open another company's `/dashboard/customers/<id>` as Company A | 404 (not data) |
| 8 | Submit the create form with a tampered `company_id` (dev tools) | rejected / ignored; row still lands in the user's own company |
| 9 | Settings: change service booking URL + interval, reload | persisted |
| 10 | 375 px viewport: list, detail, both forms | usable, no horizontal scroll |
| 11 | Company A dashboard counts vs Company B dashboard counts | each shows only its own numbers |

---

## 9. Environment variables and external services

None introduced by this phase (unless the optional logo bucket is implemented — document the bucket name and the
owner setup step). Keep `.env.example` current.

---

## 10. Files expected to change (guide)

Added: `supabase/migrations/<phase2>.sql`, `src/app/dashboard/settings/page.tsx`,
`src/app/dashboard/settings/company-form.tsx` (client), `src/app/dashboard/settings/actions.ts`,
`src/app/dashboard/customers/page.tsx`, `.../customers/new/page.tsx`, `.../customers/[id]/page.tsx`,
`.../customers/[id]/edit/page.tsx`, `.../customers/actions.ts`, shared customer form component,
`src/lib/validation/customer.ts` (zod schemas), optionally `src/lib/storage/company-assets.ts`.

Modified: `src/components/Sidebar.tsx` (add Customers + Settings), `src/app/dashboard/page.tsx` (real cards),
`supabase/tests/rls_tenant_isolation.sql` (Phase 2 section), `README.md` (feature/setup notes if needed),
`prompts/README.md` (decisions log row only).

---

## 11. Deferred (record under FUTURE PHASE NOTES)

Logo upload (if skipped), team invites/roles UI, customer notes/activity, CSV import/export, bulk actions,
customer-facing notifications, dedupe/merge, tags, and everything in Phases 3–8.

---

## 12. Stop conditions

* Phase 1 is not present in `main`, or the Phase 1 baseline gates are failing before you start.
* The `customers` table exists in a shape that conflicts with §5 and reconciling would require destroying data.
* Search/pagination cannot be implemented without a new heavy dependency (do not add one — simplify instead).
* DB credentials are unavailable → implement + document, report RLS as `UNVERIFIED`, and be explicit about what the
  owner must run.

---

## 13. Phase completion report

Finish with the standard report from `/prompts/README.md` §6. Include: whether the migration was applied or only
authored; the exact isolation-test command and result; which pre-existing failures (README §1.2) remain; the manual
matrix results; and an honest `SAFE TO MERGE`. `NO` if validation, tenant isolation or search correctness is
unverified, or if any gate fails.
