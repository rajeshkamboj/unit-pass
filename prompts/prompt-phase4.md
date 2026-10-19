# PHASE 4 — Service History and Service Opportunities

**Branch:** `phase/04-service-history` (from the latest `main`; **verify Phases 1–3 are merged**)
**Prerequisites:** Phases 1, 2 and 3 merged into `main`. /prompts/README.md read in full.
**Depends on:** Phase 3 (equipment, `next_service_date`, public UnitPass page, public RPC).
**Blocks:** Phase 6 (reminders are driven by `next_service_date`), Phase 8 (QA of the full loop).

---

## 1. Objective

Turn recorded equipment into **repeat service revenue**: log service work, show it on the homeowner's UnitPass
(public fields only), and give the office a working list of what is due in 7/30/60 days or already overdue — with a
one-click **Mark Serviced** action that logs the visit and schedules the next one.

No email automation in this phase (that is Phase 6). The value here is the dashboard + the service history.

---

## 2. Preconditions and branch setup

```bash
git status && git fetch origin --prune
git checkout main && git pull --ff-only origin main
git log --oneline -20                        # Phases 1–3 commits must be present
ls src/app/dashboard/equipment src/app/p     # Phase 3 surfaces must exist
git checkout -b phase/04-service-history
git push -u origin phase/04-service-history

pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm build     # green before you start
```

If Phase 3 is not in `main`: stop and report.

---

## 3. Scope

### 3.1 Service records

Fields (`service_records`):

* `equipment_id` (required; must belong to the caller's company)
* `company_id` (denormalised, server/trigger-derived — never accepted from a form)
* `service_date` (required, date; may be today or in the past, not more than 1 day in the future)
* `service_type` (required, enum: `Installation`, `Maintenance`, `Repair`, `Inspection`, `Warranty Service`, `Other`)
* `technician_name` (text, optional)
* `public_notes` (text, optional — appears on UnitPass)
* `private_notes` (text, optional — dashboard only, **never** on UnitPass)
* `next_service_date` (date, optional — the next visit scheduled as a result of this record)
* timestamps (`created_at`, `updated_at`)

Behaviour:

* **Create** from the equipment detail page (`/dashboard/equipment/[id]`) and from the Mark Serviced flow (§3.3).
  Server Action + `zod` validation + server-derived `company_id`.
* **Edit** an existing record (same form; company derived server-side). Allow **delete with an explicit confirmation**
  for correcting mistakes, and label it clearly as deleting a service log entry. Never cascade-delete equipment or
  customer data.
* **Timeline** on the equipment detail page: newest first, each entry showing date, type, technician, public notes and
  a clearly-labelled private note ("Private — never shown on UnitPass").
* Empty/loading/error states; mobile cards below `md`.
* Optional convenience: a "services" section on the customer detail page (list of that customer's equipment service
  records) — only if it is cheap; otherwise skip and note it.

### 3.2 Public service history on UnitPass

* Extend the Phase 3 RPC `public.get_public_unitpass(uuid)` to include a `service_history` array of
  `{ service_date, service_type, public_notes }` (include `technician_name` too — the spec treats only notes as
  private; keep it to the name, nothing else), ordered newest first, capped (e.g. the latest 20) to keep the payload
  small.
* **`private_notes` must never appear in the RPC output.**
* The public page renders a "Service history" section when entries exist (a clean, readable timeline) and hides the
  section entirely when empty. Do not show an empty heading.
* Add a "Last service" line to the warranty/identity area if a record exists (cheap, high value for the homeowner).
* Keep the public page dependency-free and server-rendered.

### 3.3 Service tracking dashboard (`/dashboard/services`)

A single screen the office can work from:

* **Summary cards**: total customers, total equipment (active), **due soon** (next service within 30 days),
  **overdue** (next service date before today). All tenant-scoped.
* **Filters** (query params, server-rendered): `next 7 days`, `next 30 days`, `next 60 days`, `overdue`, plus `all`
  (default `next 30 days`). Only consider equipment with a non-null `next_service_date`; exclude
  `status = 'Replaced'` by default (allow an explicit toggle if cheap).
* **Columns**: customer name, equipment name/type, customer phone, customer email, next service date, status chip
  (`Overdue` / `Due in <n> days` / `Upcoming`), actions.
* **Actions**:
  * **View equipment** → equipment detail.
  * **Mark serviced** → server action that (a) creates a service record with `service_date = today`,
    `service_type = 'Maintenance'` by default, and (b) updates `equipment.next_service_date` to
    `service_date + interval months` and (c) surfaces the computed date back to the user (toast/notice).
    Offer a small dialog to override the service date, type, technician, notes and the next interval **before**
    confirming — but keep the default path one click.
* **Next-date calculation** (single source of truth, in one helper used by every call site):
  `next = addMonths(service_date, equipment.service_interval ?? company.default_service_interval ?? 12)`.
  Use `date-fns` `addMonths` (already a dependency) — **do not add another date library**.
  Store `date` values (no time component, no timezone drift).
* Phone and email must be actionable (`tel:` / `mailto:`).
* Empty state: "No equipment due in this window" with a hint of the next upcoming date if one exists.
* Mobile: the table becomes a card list below `md` (do not ship a horizontally scrolling table on phones).

### 3.4 Dashboard updates

* The main `/dashboard` now shows real numbers: **total customers, total equipment, due soon (30 days), overdue** —
  the same query helpers as §3.3 (do not duplicate logic), plus a small "upcoming services" list (next 5) linking to
  the equipment. Keep the customer/company cards from Phase 2.

### 3.5 Navigation

Add **Services** to the sidebar (README §11 order: Dashboard, Customers, Equipment, Services, Settings).

---

## 4. Explicit exclusions

Email/reminder automation and delivery history (Phase 6), documents/attachments on service records (Phase 5),
service invoices/costs/quoting, work orders, dispatch/scheduling, time tracking, parts/inventory, technician mobile
apps, recurring service plan products, payments (homeowner payments are explicitly out of scope), SMS, reporting
exports, service templates/checklists, and any AI features.

**Seams for later phases (document, do not build):**
* Phase 6 will derive reminders from `equipment.next_service_date`; do not add reminder logic here.
* Keep the Mark Serviced write path as a single server action so Phase 7 can wrap it in plan/limit checks.

---

## 5. Database and migration requirements

New idempotent migration, e.g. `supabase/migrations/20261029000001_phase4_service_records.sql`:

1. Ensure the `service_type` enum exists (`do $$ ... exception when duplicate_object then null; end $$` pattern).
2. `create table if not exists public.service_records` with the §3.1 columns,
   `equipment_id uuid not null references public.equipment(id) on delete cascade`,
   `company_id uuid not null references public.companies(id) on delete cascade`, timestamps + `set_updated_at` trigger.
   * If it exists already (legacy script): `add column if not exists company_id uuid;`
     `add column if not exists updated_at timestamptz not null default now();` then backfill
     `company_id` from `equipment.company_id` and enforce `not null` — **only** if the backfill cannot fail
     (no orphan rows). If orphans exist, stop and report instead of forcing it.
3. **Trigger to prevent tenant spoofing** (the README §8.4 pattern):

```sql
create or replace function public.set_service_record_company()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select e.company_id into new.company_id from public.equipment e where e.id = new.equipment_id;
  if new.company_id is null then
    raise exception 'unknown equipment_id';
  end if;
  return new;
end $$;

drop trigger if exists service_records_set_company on public.service_records;
create trigger service_records_set_company
  before insert or update on public.service_records
  for each row execute function public.set_service_record_company();
```

4. Indexes: `service_records(company_id, service_date desc)`, `service_records(equipment_id, service_date desc)`.
5. RLS on `service_records`: `select/insert/update/delete` using `public.is_company_member(company_id)`
   (with check on insert/update). `revoke all ... from anon;` grant to `authenticated`.
   Note: because of the trigger, `with check (is_company_member(company_id))` validates the **resolved** company —
   verify this ordering actually holds in your migration test (a `before insert` trigger runs before the RLS
   `WITH CHECK` evaluation on the final row; assert it in the SQL test).
6. Update `public.get_public_unitpass(uuid)` to add `service_history` (rebuild the function body; keep the same
   signature so no `drop function` churn) and keep its `security definer` + `search_path = ''` + grants.
   Whitelist only `service_date`, `service_type`, `public_notes`, `technician_name`.
7. Cheap helper for the tracking screen (optional): a SQL view/RPC that returns equipment due in a window with customer
   contact details **for the authenticated company only** — only if it simplifies the app code; otherwise do the
   filtering in a Server Component query.

Append a Phase 4 section to `supabase/tests/rls_tenant_isolation.sql`:
* A cannot select/update/delete B's service records;
* inserting a service record with `equipment_id` from B fails (trigger + RLS);
* inserting a service record with a spoofed `company_id` (B's) but A's equipment lands with A's company (trigger wins);
* `get_public_unitpass(A token)` includes the service history array and **excludes** a seeded `private_notes` marker;
* `anon` has no table privileges on `service_records`.

---

## 6. Security requirements

1. `company_id` is never read from a form; the DB trigger resolves it from the equipment row and RLS validates it.
2. `private_notes` never reach the public page or the public RPC payload (prove it with a seeded marker + `curl | grep`).
3. Public service history is capped and ordered, and contains only the whitelisted columns.
4. RLS enabled on `service_records`; cross-tenant reads/writes fail; `anon` has no table privileges.
5. Service dates are validated (no absurd future dates, no invalid ranges); next-service math is centralised in one
   helper so Phase 6's reminders agree with what the dashboard shows.
6. Customer contact details (phone/email) are only rendered inside authenticated dashboard routes.
7. No secrets added; `.env*` stays untracked.

---

## 7. Acceptance criteria

* [ ] `pnpm typecheck && pnpm lint && pnpm build` pass.
* [ ] A service record can be created from the equipment page and from Mark Serviced, then edited; validation errors
      are inline.
* [ ] Mark Serviced logs the visit, updates `equipment.next_service_date` to the computed date, and the equipment
      disappears from the due list until the new date approaches.
* [ ] Next-date math is correct for month-end cases (e.g. service on 31 Jan with a 1-month interval must not produce
      31 Feb / an invalid date; assert the exact expected date in the test).
* [ ] Filters return exactly the right sets: next 7 / next 30 / next 60 / overdue (verify a row on day 8 appears in
      30/60 but not 7; a past date appears only in overdue).
* [ ] Summary cards (total customers, total equipment, due soon, overdue) match the underlying rows for the signed-in
      company and are correct for a second company.
* [ ] Public UnitPass shows the service history (date, type, technician, public notes) and **never** the private notes
      (seeded marker absent from the HTML).
* [ ] Replaced equipment is not counted as a service opportunity by default.
* [ ] Sidebar shows Dashboard, Customers, Equipment, Services, Settings only.
* [ ] RLS test file (Phases 1–4) passes, or `UNVERIFIED` with the owner command.
* [ ] Mobile (375 px): tracking screen and equipment service timeline are usable without horizontal scrolling.
* [ ] No future-phase functionality implemented (no reminders/email, no documents, no billing).

---

## 8. Tests and verification

```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm dev

# public exposure check for private notes
curl -s http://localhost:3000/p/<real-token> | grep -c "PRIVATE_SERVICE_MARKER_98765"   # must be 0
curl -s http://localhost:3000/p/<real-token> | grep -c "PUBLIC_SERVICE_NOTE_TEXT"      # must be >= 1

# database
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<phase4>.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
```

Manual matrix (record pass/fail):

| # | Test | Expected |
|---|---|---|
| 1 | Add a service record with both public and private notes | both stored; private labelled as private in the UI |
| 2 | Reload the public UnitPass | service entry visible (public notes), private notes absent |
| 3 | Mark serviced from the Services screen | record created, next date recalculated, toast shows the new date |
| 4 | Equipment with `next_service_date = yesterday` | appears under Overdue only |
| 5 | Equipment due in 8 days | appears in 30/60, not in 7 |
| 6 | Equipment due in 45 days | appears only in 60 |
| 7 | Replaced equipment with a past due date | excluded by default |
| 8 | Company A's Services screen vs Company B | only own rows/numbers |
| 9 | Service record created with another company's equipment id (dev tools) | rejected |
| 10 | 375 px viewport: Services + equipment timeline | usable, no horizontal scroll |

---

## 9. Environment variables and external services

None. (Reminders/email arrive in Phase 6.)

---

## 10. Files expected to change (guide)

Added: `supabase/migrations/<phase4>.sql`, `src/app/dashboard/services/page.tsx` (+ filters/table components),
`src/app/dashboard/services/actions.ts` (mark serviced), `src/app/dashboard/equipment/[id]/service-record/*`
or an inline dialog component, `src/lib/services/next-service-date.ts` (shared math),
`src/lib/queries/service-opportunities.ts` (shared dashboard queries), `src/lib/validation/service-record.ts`.

Modified: `src/app/dashboard/equipment/[id]/page.tsx` (timeline + add service), `src/app/dashboard/page.tsx`
(real summary numbers), `src/components/Sidebar.tsx` (Services), `src/app/p/[token]/page.tsx` (service history
section), `supabase/tests/rls_tenant_isolation.sql` (Phase 4 section), `README.md`, `prompts/README.md` (decisions
log row only).

---

## 11. Deferred (record under FUTURE PHASE NOTES)

Reminder windows/dedupe (Phase 6), documents attached to service records (Phase 5), service checklists/templates,
technician assignment, invoicing/costs, exports, homeowner notifications, replacing/rotating next-service logic when a
customer declines service (a "service not performed" path), and everything in Phases 6–8.

---

## 12. Stop conditions

* Phase 3 is not in `main`, or the baseline gates fail before you start.
* The existing `service_records` table cannot be backfilled with `company_id` without hitting orphan rows.
* The public RPC must expose something outside the whitelist to make the page work (do not — redesign the payload).
* DB credentials are unavailable → implement + document, report `SECURITY CHECK: UNVERIFIED`, and list the owner
  commands.

---

## 13. Phase completion report

Finish with the standard report from `/prompts/README.md` §6. Include: the migration and whether it was applied; the
exact month-end arithmetic example and its result; the filter-window evidence; the private-notes public-exposure grep
result; the isolation-test result; and an honest `SAFE TO MERGE`.
