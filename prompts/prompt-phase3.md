# PHASE 3 — Equipment, QR Codes and the Public UnitPass

**Branch:** `phase/03-unitpass-qr` (create from the latest `main` — **verify Phases 1 and 2 are merged first**)
**Prerequisites:** Phase 1 and Phase 2 merged into `main`. /prompts/README.md read in full.
**Depends on:** Phase 1 (auth, tenancy, RLS helpers), Phase 2 (customers, company profile incl. `service_booking_url`).
**Blocks:** Phases 4, 5, 6, 7 (everything hangs off equipment and its public token).

**This is the most important product-validation phase.** When it ends, the core loop must work end to end:

> **CUSTOMER → EQUIPMENT → QR → SCAN → UNITPASS**

---

## 1. Objective

Let an HVAC company record installed equipment, give every record a permanent unguessable public token, generate and
print a QR code that resolves to a fast, professional, mobile-first public "UnitPass" page, and give the homeowner a
Book Service action — while exposing **only** explicitly public information.

---

## 2. Preconditions and branch setup

```bash
git status && git fetch origin --prune
git checkout main && git pull --ff-only origin main
git log --oneline -15                      # confirm Phase 1 + Phase 2 commits are in main
ls src/app/dashboard/customers src/app/dashboard/settings   # Phase 2 surfaces must exist
git checkout -b phase/03-unitpass-qr
git push -u origin phase/03-unitpass-qr

pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm build   # must be green before you start
```

If Phase 2 is not in `main`, stop and report. Never branch off `phase/02-customers`.

---

## 3. Scope

### 3.1 Equipment management (authenticated dashboard)

Routes:

| Route | Purpose |
|---|---|
| `/dashboard/equipment` | List + search + filters + pagination |
| `/dashboard/equipment/new` | Create (accepts `?customer_id=` prefill) |
| `/dashboard/equipment/[id]` | Detail (identity, warranty, service dates, notes, photo, QR link) |
| `/dashboard/equipment/[id]/edit` | Edit |
| `/dashboard/equipment/[id]/qr` | QR view / download PNG / printable label / copy link |

Fields (reuse the existing column names from the legacy schema):

* `customer_id` (required, must belong to the same company)
* `equipment_name` (required — e.g. "Downstairs AC")
* `equipment_type` (required, enum below)
* `manufacturer`, `model_number`, `serial_number`
* `installation_date` (date)
* `warranty_expiration_date` (date), `warranty_notes` (text, **public**)
* `next_service_date` (date, may be empty)
* `service_interval` (integer months, nullable → falls back to the company default)
* `installer_notes` (**private**, dashboard-only)
* `public_notes` (text, appears on UnitPass)
* equipment photo (see §3.4)
* `status` (enum below, default `Active`)

Enums (already defined in the legacy schema — reuse them, do not invent new spellings):

* `equipment_type`: `Air Conditioner`, `Furnace`, `Heat Pump`, `Mini Split`, `Boiler`, `Air Handler`, `Other`
* `equipment_status`: `Active`, `Inactive`, `Replaced`

Behaviour:

* **Create/edit via Server Actions** (server-derived `company_id`) with `zod` validation and field-level errors.
  Validate that the chosen `customer_id` belongs to the caller's company before writing (RLS is the backstop, but the
  UX must fail cleanly).
* **List**: filters by customer, type and status; search by equipment name, manufacturer, model or serial
  (`ilike`, case-insensitive); active-first ordering (e.g. `status`, then `next_service_date nulls last`, then
  `created_at desc`); 25 per page via `range()`.
* **Detail**: identity card, warranty card (with an "expired / expires on …" indicator), service dates, public vs
  private notes clearly labelled (**label the private one as "Private — never shown on UnitPass"**), photo, and
  actions: Edit, View QR, Public page link.
* **No hard delete.** Retire equipment by setting `status = 'Replaced'` (the QR stays valid — see §3.5). Do not
  implement a delete button.
* Show a clear "QR is permanent" warning on the delete/replace path.
* Empty / loading / error states; mobile-first layout (cards below `md`).
* Nav: add **Equipment** (README §11 ordering).

### 3.2 Public token (the security-critical identifier)

* Column: `equipment.public_token` — `uuid not null unique default gen_random_uuid()`, backfilled for existing rows.
* Generated server-side by the database default at insert time. **It is assigned once and never changes.**
* Add a `before update` trigger (or an explicit `check`) that **prevents changing `public_token`** after creation, so
  no future code path can invalidate printed QR codes. Document this in the migration comments.
* Never expose internal UUIDs (`equipment.id`, `customer_id`, `company_id`) on public routes. The token is the only
  public identifier.
* Do not derive the token from any data (no serial numbers, no sequential ids, no hashing of ids).

### 3.3 QR codes

Dependency: add **`qrcode`** (plus `@types/qrcode` as a devDependency). Do not add a second QR library.

* Payload: `${NEXT_PUBLIC_SITE_URL}/p/${equipment.public_token}` (single source of truth in one helper, e.g.
  `src/lib/public/unitpass-url.ts`). Include the `https://` origin in production — a QR that only works on
  `localhost` is useless in the field; document `NEXT_PUBLIC_SITE_URL` in the owner setup instructions.
* QR page (`/dashboard/equipment/[id]/qr`):
  * renders the QR from the token (client component using `qrcode.toDataURL`, error correction level `M` or higher,
    ≥ 512 px output for print quality);
  * **Download PNG** (client-side anchor with the data URL; filename
    `unitpass-{customer-last-name}-{equipment-name-slug}.png` — the token must still be encoded inside, obviously);
  * **Copy public link** button (with a success toast);
  * **Printable label**: a print-optimised block (equipment name, manufacturer/model, company name + phone,
    "Scan for warranty, service history and to book service", the QR) with `@media print` rules that hide the app
    chrome — a simple `window.print()` button is sufficient. No PDF library, no label-design tool.
  * A short reassurance line: "This QR code is permanent. It keeps working when you update this equipment record."
* The QR page must never be the only path to the token: also show the public link on the equipment detail page.

### 3.4 Equipment photo (implement if cheap — otherwise defer and document)

If implemented:

* private bucket `equipment-photos` (no public read), path `{company_id}/{equipment_id}/photo-{uuid}.{ext}`;
* ≤ 10 MB, MIME allowlist `image/jpeg`, `image/png`, `image/webp`;
* storage policies scoped to the member's company prefix;
* store the **path** in a new column `equipment_photo_path` (the legacy `equipment_photo_url` column stays untouched
  and unused — note it as deprecated in the report; do not `drop column`);
* the dashboard and the public page display it via a **server-generated short-lived signed URL** (5–15 minutes)
  created server-side (admin client, server-only module) — never a public bucket for private media;
* if this cannot be done in this phase without bloating scope, skip it and record it in `FUTURE PHASE NOTES`.

### 3.5 Public UnitPass page (`/p/[token]`)

A **Server Component** at `src/app/p/[token]/page.tsx`:

* `export const dynamic = 'force-dynamic'`; no auth; mobile-first; fast (a single RPC round trip; no client-side
  waterfalls).
* `notFound()` for an unknown token (generic 404 — never reveal whether a token exists in a different company).
* `generateMetadata`: equipment name + company name; **`robots: { index: false, follow: false }`** (a passport must not
  be indexed by search engines).
* Sections:
  1. **Header** — company name, logo (if available), "Digital Service Passport" label, Powered-by-UnitPass line.
  2. **Equipment** — name, type, manufacturer, model, serial number (this is on the physical unit's label, so it is
     acceptable), installation date, photo (if any), status badge.
  3. **Warranty** — status (`Active` / `Expired` / `Expires <date>` / not recorded), expiry date, `warranty_notes`.
  4. **Notes** — `public_notes` **only**.
  5. **Book Service** — if `companies.service_booking_url` exists, a prominent "Book Service" button to that URL
     (`target="_blank"`, `rel="noopener noreferrer"`); otherwise an equally clear card showing the company phone
     (`tel:`) and email (`mailto:`). Never render a dead button.
  6. Company contact block (phone, email, website) — `tel:`/`mailto:` links.
  7. Placeholders for service history (Phase 4) and public documents (Phase 5) are **not** to be built now.
* **Status handling (QR permanence):** never 404 because of status.
  * `Active` → normal passport.
  * `Inactive` → passport + "Not currently in service" notice.
  * `Replaced` → passport + prominent notice ("This equipment has been replaced. Contact {company} for details.") and
    the company contact block. The homeowner must always be able to reach the company.
* Accessibility: semantic headings, sufficient contrast, ≥ 16 px body text, alt text, focus-visible styles; no
  horizontal scroll at 375 px; ship no heavy client JS on this page.

### 3.6 Public data access (the whitelist rule)

**Do not** select the equipment row and hide private fields in the UI. Create a `SECURITY DEFINER` RPC that returns
exactly the approved public payload:

```sql
create or replace function public.get_public_unitpass(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'company', jsonb_build_object(
      'name', c.name, 'phone', c.phone, 'email', c.email,
      'website', c.website, 'service_booking_url', c.service_booking_url,
      'logo_url', c.logo_url
    ),
    'equipment', jsonb_build_object(
      'name', e.equipment_name, 'type', e.equipment_type, 'manufacturer', e.manufacturer,
      'model_number', e.model_number, 'serial_number', e.serial_number,
      'installation_date', e.installation_date,
      'warranty_expiration_date', e.warranty_expiration_date,
      'warranty_notes', e.warranty_notes,
      'public_notes', e.public_notes,
      'status', e.status,
      'photo_path', e.equipment_photo_path
    )
  )
  from public.equipment e
  join public.companies c on c.id = e.company_id
  where e.public_token = p_token;
$$;

revoke all on function public.get_public_unitpass(uuid) from public;
grant execute on function public.get_public_unitpass(uuid) to anon, authenticated;
```

* The returned JSON must contain **no** internal ids, no `installer_notes`, no customer PII
  (name, email, phone, postal address), no tenant internals, no reminder/billing data.
* Return `null`/no row for unknown tokens; the page renders `notFound()`.
* `anon` must have `execute` on this function and **no table privileges** on `equipment`/`customers`/`companies`.
* Signed photo URLs are generated in the server component after the RPC returns (server-only admin client), or omit
  photos entirely for now.

Add a server-side helper `src/lib/public/get-unitpass.ts` that calls the RPC and maps the JSON to a typed object
(hand-written type or generated Supabase types) — the page must not build SQL/`select` strings itself.

---

## 4. Explicit exclusions

Service records/history (Phase 4), documents (Phase 5), reminders/email (Phase 6), Stripe/billing/usage limits
(Phase 7), landing-page polish and onboarding checklist (Phase 8), bulk import, equipment transfer between customers
(beyond editing `customer_id`), multiple photos/galleries, maintenance checklists, warranty-claim workflows,
equipment analytics, homeowner accounts/logins, homeowner payments, appointment scheduling, SMS, CSV export,
public "list all equipment" pages, and any public API beyond the single token-based RPC.

**Seam for Phase 7 (do not build it now):** equipment creation must go through a **Server Action** (a single server-side
code path) so Phase 7 can insert a usage-limit check there without re-architecting.

---

## 5. Database and migration requirements

New idempotent migration, e.g. `supabase/migrations/20261022000001_phase3_equipment.sql`:

1. Ensure the enums exist (`equipment_type`, `equipment_status`) — `do $$ begin ... exception when duplicate_object then null; end $$;`
   pattern for `create type` (safe if the legacy script already created them).
2. `create table if not exists public.equipment` with the §3.1 columns, `company_id uuid not null references public.companies(id)`,
   `customer_id uuid not null references public.customers(id)`, `status public.equipment_status not null default 'Active'`,
   `public_token uuid not null unique default gen_random_uuid()`, timestamps + `set_updated_at` trigger.
   * If it already exists: `add column if not exists` for what is missing
     (`equipment_photo_path`, anything else), backfill `public_token` where null, then
     `alter column public_token set not null;` and `alter column public_token set default gen_random_uuid();`
     plus `create unique index if not exists equipment_public_token_key on public.equipment(public_token);`
   * `add column if not exists archived_at timestamptz;` (soft retirement is via `status`; `archived_at` is optional —
     only add it if you actually use it; otherwise skip to avoid dead columns).
3. Immutability trigger:

```sql
create or replace function public.prevent_public_token_change()
returns trigger language plpgsql as $$
begin
  if old.public_token is distinct from new.public_token then
    raise exception 'public_token is immutable';
  end if;
  return new;
end $$;

drop trigger if exists equipment_public_token_immutable on public.equipment;
create trigger equipment_public_token_immutable
  before update on public.equipment
  for each row execute function public.prevent_public_token_change();
```

4. Indexes: `equipment(public_token)` (unique), `equipment(company_id, status)`,
   `equipment(company_id, customer_id)`, `equipment(company_id, next_service_date)`.
5. RLS: enable; policies for `select/insert/update/delete` using/with check `public.is_company_member(company_id)`;
   `revoke all on public.equipment from anon;` grant to `authenticated` (the **only** anonymous access is the RPC
   in §3.6, which is `SECURITY DEFINER`).
6. `public.get_public_unitpass(uuid)` exactly as in §3.6 (+ grants).
7. If the photo bucket is implemented: idempotent `storage.buckets` insert + storage policies scoped to the company
   prefix; if you cannot run `storage.*` DDL, document the dashboard steps instead and say so.

Append a Phase 3 section to `supabase/tests/rls_tenant_isolation.sql`:
* A cannot select/update B's equipment;
* A inserting equipment with B's `company_id` (or B's `customer_id`) fails;
* `anon` cannot `select` from `equipment` (expect permission denied / zero rows);
* `get_public_unitpass(<A's token>)` as `anon` returns a payload that **does not contain** `installer_notes`,
  `customer` PII keys, or any `id` key;
* `get_public_unitpass(<unknown uuid>)` returns no row;
* updating `public_token` raises the immutability exception.

---

## 6. Security requirements

1. **Public whitelist only** — the public page is fed by the RPC, never by `select *` on `equipment`. No field hiding
   in CSS/JS.
2. **Never public**: internal UUIDs, `installer_notes`, customer PII, `company_id`, tenant internals,
   reminder/billing/subscription data, private documents (Phase 5), private service notes (Phase 4).
3. Tokens are non-sequential, unguessable (UUIDv4 = 122 random bits), unique and immutable; unknown tokens 404.
4. RLS enabled on `equipment`; `anon` has zero table privileges; only the RPC is callable anonymously.
5. Photo/document access is via short-lived server-generated signed URLs; no public buckets for private media.
6. Server Actions derive `company_id` from the session; a tampered `company_id`/`customer_id` in a request must fail
   (prove it in the SQL test).
7. `NEXT_PUBLIC_SITE_URL` must be used for QR payloads; document that a wrong value produces QR codes that only work
   locally (a real-world failure this phase must prevent).
8. No secrets in git; any new variable names go in `.env.example`.

---

## 7. Acceptance criteria

* [ ] `pnpm typecheck && pnpm lint && pnpm build` pass.
* [ ] Equipment can be created, listed (with filters/search/pagination), viewed and edited; validation errors are
      inline and human-readable.
* [ ] An equipment record cannot be created for another company's customer, and Company A cannot read or modify
      Company B's equipment (SQL test + UI).
* [ ] Every equipment record has a `public_token` (unique, non-null, immutable) — verified by attempting an update.
* [ ] The QR page renders a scannable QR that resolves to `/p/{token}`, the PNG downloads, and the printable label
      prints without app chrome.
* [ ] **Editing any equipment field does not change the token or break the QR** (verify explicitly, before and after).
* [ ] `/p/{token}` is public (no auth), mobile-first at 375 px, and shows equipment details, warranty info, public
      notes, company contact and a working **Book Service** action (booking URL when present, otherwise phone/email).
* [ ] `/p/{unknown-token}` renders a 404 (no leaked data, no stack trace).
* [ ] The rendered public HTML/JSON contains **none** of: a seeded unique marker placed in `installer_notes`,
      the customer's name/email/phone/address, any internal UUID (equipment/company/customer id).
* [ ] `Inactive` and `Replaced` equipment still resolve on the public page with the appropriate notice.
* [ ] Public page requests do not require a session and do not include auth headers in the HTML.
* [ ] Nav shows Dashboard, Customers, Equipment, Settings only.
* [ ] RLS test file (Phases 1–3 sections) passes, or is reported `UNVERIFIED` with the owner command.
* [ ] No future-phase functionality implemented.

---

## 8. Tests and verification

```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm dev

# public page behaviour (adjust token)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/p/11111111-1111-1111-1111-111111111111   # 404
curl -s http://localhost:3000/p/<real-token> | grep -c "PRIVATE_MARKER_12345"      # must be 0
curl -s http://localhost:3000/p/<real-token> | grep -ci "installer\|customer_email\|customer@example.com"  # 0

# database
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<phase3>.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
```

Manual matrix (record pass/fail):

| # | Test | Expected |
|---|---|---|
| 1 | Create equipment for an existing customer | saved, appears in list, detail correct |
| 2 | Try to create equipment with a customer id from another company | rejected with a clean error |
| 3 | Edit equipment (model, notes, dates) | saved; **token unchanged**; existing QR/URL still works |
| 4 | Open the QR page, download PNG | valid PNG, scans to the correct URL |
| 5 | Print the label from a phone/desktop preview | QR + key details, no dashboard chrome |
| 6 | Scan the QR with a phone | public page loads fast, fully readable at 375 px |
| 7 | Mark equipment `Replaced` | public page still loads, shows the replacement notice + contact |
| 8 | Set status `Inactive` | public page loads with the "not currently in service" notice |
| 9 | Put a marker in `installer_notes` and in the customer's last name, then reload the public page | marker and PII absent from the page source |
| 10 | Visit `/p/<random-uuid>` | 404 page, no data |
| 11 | Company A equipment list vs Company B | only own rows |
| 12 | Filters: customer, type, status, search "carrier"/partial serial | correct subsets |

---

## 9. Environment variables and external services

New variables: none required beyond an accurate **`NEXT_PUBLIC_SITE_URL`** (already in `.env.example` from Phase 1).
Document in `README.md` that this value must be the production origin before printing labels (otherwise QR codes point
at the wrong host), and that changing it later does **not** fix already-printed QR codes — i.e. set it correctly before
going live.

New dependency: `qrcode` (+ `@types/qrcode` dev). If the photo feature is implemented, it needs
`SUPABASE_SERVICE_ROLE_KEY` to be present (server-only) for signed URLs — add the name to `.env.example` and create
`src/lib/supabase/admin.ts` with `import 'server-only'`.

---

## 10. Files expected to change (guide)

Added: `supabase/migrations/<phase3>.sql`, `src/app/dashboard/equipment/**` (list, new, detail, edit, qr, actions,
form components), `src/app/p/[token]/page.tsx` (+ supporting components), `src/lib/public/unitpass-url.ts`,
`src/lib/public/get-unitpass.ts`, `src/lib/validation/equipment.ts`,
optionally `src/lib/supabase/admin.ts` and `src/lib/storage/equipment-photos.ts`.

Modified: `src/components/Sidebar.tsx` (Equipment), `package.json` + `pnpm-lock.yaml` (qrcode),
`supabase/tests/rls_tenant_isolation.sql` (Phase 3 section), `.env.example`, `README.md`, `prompts/README.md`
(decisions log row only), possibly `public/robots.txt` (disallow `/p/`), and `next.config.mjs` (only if image
handling needs it).

---

## 11. Deferred (record under FUTURE PHASE NOTES)

Equipment photos (if skipped), gallery/multiple photos, QR label templates, bulk QR printing, equipment transfer
between customers, warranty-claim tracking, homeowner accounts, service history (Phase 4), documents (Phase 5),
reminders (Phase 6), usage limits (Phase 7), landing-page polish and onboarding checklist (Phase 8).

---

## 12. Stop conditions

* Phase 1/2 are not in `main`, or the baseline gates fail before you start.
* The equipment table exists with incompatible data that cannot be reconciled non-destructively.
* Implementing the public page would require exposing table data directly (do not — build the RPC instead).
* Photos cannot be done safely within scope (skip and document).
* DB credentials are unavailable → implement + document, report `SECURITY CHECK: UNVERIFIED`, and give the owner the
  exact commands (migration + isolation test + the public-page `curl` greps).

---

## 13. Phase completion report

Finish with the standard report from `/prompts/README.md` §6. Required specifics: the migration file and whether it
was applied; the isolation/public-exposure test commands and their results; the seeded-marker evidence that private
data is absent from the public page; confirmation that the token is immutable after edits; and an honest
`SAFE TO MERGE` — `NO` if public exposure or tenant isolation is unverified, or if the demo loop is incomplete.
