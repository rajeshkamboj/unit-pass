# PHASE 6 — Service Reminders and Email

**Branch:** `phase/06-reminders` (from the latest `main`; **verify Phases 1–5 are merged**)
**Prerequisites:** Phases 1–5 merged into `main`. /prompts/README.md read in full.
**Depends on:** Phase 3 (`equipment.next_service_date`), Phase 4 (service math helper + Services screen), Phase 2
(company email/settings).
**Blocks:** Phase 8 (reminder QA).

---

## 1. Objective

Make UnitPass *proactively* useful: a scheduled job scans equipment whose `next_service_date` is approaching or past
and emails the **HVAC company** so it can call the homeowner — with **no duplicate sends**, a stored delivery history,
and an architecture that runs on the deployment platform (Vercel Cron).

MVP scope: **notifications to the company only**. No SMS. No marketing automation.

---

## 2. Preconditions and branch setup

```bash
git status && git fetch origin --prune
git checkout main && git pull --ff-only origin main
git log --oneline -25                        # Phases 1–5 must be present
ls src/app/dashboard/services                # Phase 4 surface must exist
git checkout -b phase/06-reminders
git push -u origin phase/06-reminders

pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm build     # green before you start
```

If Phase 5 is not in `main`: stop and report.

---

## 3. Scope

### 3.1 Reminder model

Extend the existing `reminders` table (do not create a parallel concept):

| Column | Notes |
|---|---|
| `company_id` | already exists (keep) |
| `equipment_id` | already exists (keep) |
| `due_date` | **new** — the `equipment.next_service_date` value this reminder is about |
| `days_before` | **new** — `30`, `7`, or `0`/`-7`/`-14`/… for overdue repeats (see §3.3) |
| `channel` | **new** — `'email'` for this phase (no other values implemented) |
| `recipient` | **new** — the address the reminder went to (snapshot) |
| `reminder_type` | existing enum (`Service Due` / `Service Overdue`) — reuse it |
| `status` | existing enum (`Pending` / `Sent` / `Failed`) — reuse it, **plus add `Skipped`** (see §5) |
| `sent_at` | already exists (keep) |
| `provider_message_id` | **new** — Resend message id when available |
| `error` | **new** — failure reason when `status = 'Failed'` |
| `created_at` | already exists (keep) |

**Duplicate prevention (the core requirement):** a unique index on
`(equipment_id, due_date, days_before)`; every insert uses
`insert ... on conflict (equipment_id, due_date, days_before) do nothing returning id` — if no row comes back, the
reminder was already recorded (or is being sent by a concurrent run) and must **not** be sent again.

`companies.reminders_enabled boolean not null default true` (settable from Settings) lets a company switch reminders
off; when off, the scanner **does not insert** anything (no rows, no emails).

### 3.2 Email (Resend)

* Dependency: **`resend`** (server-only). Do not add `react-email`, `nodemailer`, or any template framework.
* `src/lib/email/resend.ts` — server-only client using `RESEND_API_KEY`; fail fast with a clear error when missing.
* `src/lib/email/templates/service-reminder.ts` — a plain function returning
  `{ subject, html, text }` (both HTML and plain-text parts; no external CSS; inline styles only; mobile-friendly).
  Compose one template with a `kind` parameter (`due_in_30`, `due_in_7`, `overdue`) rather than three files.
* Content (company-facing): equipment name/type, manufacturer/model, customer name, customer phone/email,
  next service date (or days overdue), company links: open the Services screen
  (`${NEXT_PUBLIC_SITE_URL}/dashboard/services`) and the equipment record. Keep internal notes out of the email.
* From: `RESEND_FROM_EMAIL` (owner must verify a domain, or use `onboarding@resend.dev` for testing — document this).
  Reply-to: the company's own email is **not** correct (the mail goes *to* the company) — leave reply-to unset unless
  the owner asks for a specific address.
* Sending is best-effort and must never fail the whole cron run: catch per-reminder errors, store `status = 'Failed'`
  and `error`, and continue.

### 3.3 Reminder windows and cadence

Single source of truth: a pure function (e.g. `src/lib/reminders/schedule.ts`) that, given
`today`, `next_service_date`, returns the list of candidate `{ reminder_type, days_before, due_date }` to attempt:

* `days_until = next_service_date - today` (in whole days, UTC dates)
* `30 <= days_until <= 30` window: when `days_until <= 30 && days_until > 7` → candidate `Service Due`, `days_before = 30`
* when `0 <= days_until <= 7` → candidate `Service Due`, `days_before = 7`
* when `days_until < 0` and `days_until % 7 === 0` and `days_until >= -56` → candidate `Service Overdue`,
  `days_before = days_until` (i.e. `0` never happens for overdue — the first overdue send is `-7`;
  **also send once on the first overdue day**: treat `days_until === -1` as `days_before = 0`, or simply include
  `days_until in {-1}` as the "just became overdue" send — pick one rule, implement it in the helper, and document it
  in the code comment and the report)
* otherwise → no candidate

Properties this must have (assert them in tests):

* running the job twice in a row sends **exactly one** email per candidate (unique index);
* an equipment record created 5 days before its due date still gets the `days_before = 7` reminder (no missed window);
* moving `next_service_date` forward creates a **new** reminder set for the new `due_date` (dedupe is per due date);
* overdue reminders repeat weekly for up to 8 weeks, then stop (no infinite nagging);
* equipment with `status = 'Replaced'` or no `next_service_date` is never reminded.

Equipment selection: `status = 'Active'` (decide and document whether `Inactive` should be included — default: exclude),
`company_id` with `reminders_enabled = true`, `next_service_date is not null`, and `next_service_date <= today + 30 days`.

### 3.4 Scheduled execution

* Route handler: `src/app/api/cron/reminders/route.ts` (GET; `export const dynamic = 'force-dynamic'`).
* Auth: require `Authorization: Bearer ${CRON_SECRET}` (constant-time-ish comparison; 401 otherwise, no body details).
  Vercel Cron sends this header when `CRON_SECRET` is set — document that.
* Behaviour: load candidates (admin client, server-only), for each candidate try to claim the reminder row with
  `on conflict do nothing returning id`; if claimed, send via Resend and update the row
  (`Sent` + `provider_message_id` + `sent_at`, or `Failed` + `error`); if not claimed, skip silently.
  Return a JSON summary: `{ scanned, candidates, sent, failed, skipped, durationMs }` — never secrets or message bodies.
* `vercel.json` (recreate it — Phase 1 deleted the broken SPA rewrite): include only the cron definition,

```json
{ "crons": [{ "path": "/api/cron/reminders", "schedule": "0 13 * * *" }] }
```

  Daily at 13:00 UTC. Document the plan limitations (Vercel Hobby allows daily crons; more frequent schedules need
  Pro) and that the owner can also trigger the endpoint manually with `curl` + the secret.
* Keep the handler idempotent and safe to run repeatedly; add a hard cap (e.g. 200 reminders per run) to avoid
  unbounded loops, and log the summary server-side.

### 3.5 Reminder history UI

* Settings → a "Reminders" section (or a dedicated `/dashboard/settings/reminders` subsection) listing the last ~50
  reminders for the company: equipment, customer, due date, `days_before` label (30-day / 7-day / overdue), recipient,
  status (`Sent`/`Failed`/`Skipped`/`Pending`), sent time, and the error text for failures.
* Include the `reminders_enabled` toggle and a short explanation of the windows (30 days before, 7 days before,
  then weekly while overdue).
* Read-only history is sufficient; do not build reminder editing, per-customer preferences, or rescheduling.
* Show a helpful empty state ("No reminders sent yet — reminders are sent automatically when equipment is due").

### 3.6 Dashboard seam

If cheap: add a small "Reminders" summary line to `/dashboard` (e.g. "3 reminders sent in the last 30 days").
Do not duplicate the Services screen logic.

---

## 4. Explicit exclusions

* **SMS — never** (explicitly prohibited).
* Marketing/automation flows, drip campaigns, newsletters, bulk email.
* **Homeowner reminders** — deferred. They are only acceptable in this phase if they are *trivially* simple, and must
  then be documented in `FUTURE PHASE NOTES` with the explicit opt-in/consent story. Default: do not send email to
  homeowners at all. Do not add a homeowner email field for this purpose.
* Push notifications, in-app notifications, digests, per-customer reminder preferences, escalation chains, WhatsApp,
  calendars/ICS attachments, appointment scheduling (excluded product-wide), and everything in Phases 7–8
  (billing/limits/landing page).
* Do not build a general job queue or background worker infrastructure — one cron endpoint is the MVP.

---

## 5. Database and migration requirements

New idempotent migration, e.g. `supabase/migrations/20261112000001_phase6_reminders.sql`:

1. `companies`: `add column if not exists reminders_enabled boolean not null default true;`
   (optionally `add column if not exists reminder_recipient text;` only if you actually use it — prefer `companies.email`
   for the MVP; skip the extra column).
2. `reminders` (idempotent alters, keep existing rows):
   * `add column if not exists due_date date;`
   * `add column if not exists days_before integer;`
   * `add column if not exists channel text not null default 'email';`
   * `add column if not exists recipient text;`
   * `add column if not exists provider_message_id text;`
   * `add column if not exists error text;`
   * `add column if not exists updated_at timestamptz not null default now();` (+ trigger)
   * add the enum value: `alter type public.reminder_status add value if not exists 'Skipped';`
     (Postgres 12+ allows this inside a transaction; do **not** insert a row using the new value in this same
     migration — the app writes it later.) If `reminder_status` does not exist, create it with all four values.
   * unique index: `create unique index if not exists reminders_unique_dedupe on public.reminders(equipment_id, due_date, days_before);`
     **This index is the duplicate-prevention mechanism — it must exist and must be verified.**
   * indexes: `reminders(company_id, created_at desc)`, `reminders(company_id, status)`.
3. RLS on `reminders`: enable; `select` using `public.is_company_member(company_id)`; insert/update/delete for members
   (the cron uses the service-role/admin client, which bypasses RLS — that is acceptable and must stay server-only).
   `revoke all on public.reminders from anon;` grant to `authenticated`.
   (No public exposure whatsoever.)
4. Nothing in the public UnitPass RPC changes in this phase.

Append a Phase 6 section to `supabase/tests/rls_tenant_isolation.sql`:
* A cannot select/insert/update/delete B's reminders;
* the unique index rejects a duplicate `(equipment_id, due_date, days_before)` insert;
* `anon` has no privileges on `reminders`.

---

## 6. Security requirements

1. `CRON_SECRET` is required; the endpoint returns 401 without a correct bearer token and leaks nothing.
2. All reminder writes in the cron path use the **server-only** admin client; the service-role key never reaches the
   client bundle (`grep -rn "SERVICE_ROLE" src/app src/components` must find no client-file usage).
3. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` are server-only; no email addresses of customers are ever emailed or
   exposed beyond the authenticated dashboard.
4. Reminders are tenant-scoped: dashboard history shows only the signed-in company's rows (RLS).
5. The email payload contains no private notes, no internal ids (except links that require authentication), no
   secrets, and no homeowner-facing claims.
6. The cron handler must be safe under retries/concurrency: claim-then-send with the unique index; never send the same
   reminder twice even if the endpoint is called repeatedly.
7. Failed sends are recorded with a sanitised error string (no API keys, no full provider responses with secrets).
8. Emails are only sent to the **company's own** address in this phase.

---

## 7. Acceptance criteria

* [ ] `pnpm typecheck && pnpm lint && pnpm build` pass.
* [ ] The unique index exists (verify with `\d public.reminders` / `pg_indexes`) and a duplicate insert is rejected.
* [ ] Running the cron endpoint twice in the same day produces exactly one email/reminder row per candidate
      (prove it: run, count rows, run again, count unchanged).
* [ ] Windows behave as specified: a `next_service_date` 20 days out gets a `days_before = 30` reminder;
      8 days out gets only `7`; overdue repeats weekly and stops after 8 weeks. Verify the pure helper with a
      **throwaway local script** (run it, paste the output, delete it) and with at least one manual end-to-end case
      using seeded dates — do **not** install a test framework (see `/prompts/README.md` §7.1).
* [ ] Equipment with `status = 'Replaced'` or no next service date never produces a reminder.
* [ ] A company with `reminders_enabled = false` produces zero reminders/emails.
* [ ] Emails actually send when Resend credentials are configured; without credentials the endpoint fails soft
      (`status = 'Failed'`, error recorded, HTTP 200 with a summary, no crash) and this is documented.
* [ ] Cron auth: `curl` without the bearer token → 401; with it → 200 + JSON summary.
* [ ] Reminder history UI lists the company's reminders with status/recipient/date and hides other companies' rows.
* [ ] `vercel.json` contains the cron schedule and nothing that breaks routing.
* [ ] No SMS, no marketing, no homeowner emails (unless trivially implemented and documented as deferred-safe).
* [ ] RLS test file (Phases 1–6) passes, or `UNVERIFIED` with the owner command.

---

## 8. Tests and verification

```bash
pnpm typecheck && pnpm lint && pnpm build

# cron auth
pnpm dev
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/reminders            # 401
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders     # 200 + JSON summary
# run it twice and compare the reminder rows
psql "$SUPABASE_DB_URL" -c "select count(*) from public.reminders where due_date = '<seeded>' and days_before = 30;"

# database
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<phase6>.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
```

Manual matrix (record pass/fail; seed dates relative to *today*):

| # | Setup | Expected |
|---|---|---|
| 1 | Equipment due in 20 days, cron run | one `Service Due`/30 row + one email attempt |
| 2 | Same equipment, cron run again | no new row, no second email |
| 3 | Equipment due in 5 days | `Service Due`/7 reminder |
| 4 | Equipment due yesterday | overdue reminder (by the rule you chose) and no duplicate on the next run |
| 5 | Equipment due 21 days ago (weekly cadence) | overdue reminders on the 7-day multiples only, stopping after 8 weeks |
| 6 | Move the next service date 6 months out, run again | new reminder set for the new due date when it enters the window |
| 7 | Company with reminders off | zero rows, zero emails |
| 8 | Replaced equipment | never reminded |
| 9 | Invalid Resend key | `Failed` row with a sanitised error, endpoint still returns a summary |
| 10 | Company A history vs Company B history | only own rows |
| 11 | Email rendering (open the received mail on a phone) | readable, correct dates, working dashboard link |

---

## 9. Environment variables and external services

New (add names to `.env.example`, document setup in `README.md`):
* `RESEND_API_KEY` — server only.
* `RESEND_FROM_EMAIL` — e.g. `UnitPass <reminders@yourdomain.com>` (or `onboarding@resend.dev` for testing).
* `CRON_SECRET` — server only; must also be set in the Vercel project for Cron to authenticate.

Owner configuration required: Resend account + verified domain (or the test sender), Vercel cron (automatic once
`vercel.json` is deployed with `CRON_SECRET` set), and a decision on the sending address. Without these, report
`SECURITY CHECK` accurately and mark delivery as **unverified** — never claim emails were sent.

---

## 10. Files expected to change (guide)

Added: `supabase/migrations/<phase6>.sql`, `src/app/api/cron/reminders/route.ts`,
`src/lib/reminders/schedule.ts` (pure helper), `src/lib/reminders/run.ts` (scan/claim/send orchestration),
`src/lib/email/resend.ts`, `src/lib/email/templates/service-reminder.ts`,
`src/app/dashboard/settings/reminders/page.tsx` (or a section in the settings page), `vercel.json`.

Modified: `src/app/dashboard/settings/**` (toggle), `src/app/dashboard/page.tsx` (optional summary line),
`supabase/tests/rls_tenant_isolation.sql` (Phase 6 section), `.env.example`, `README.md`, `prompts/README.md`
(decisions log row only).

---

## 11. Deferred (record under FUTURE PHASE NOTES)

Homeowner reminders (with consent), digest emails, per-customer frequency preferences, weekly/monthly resend policies,
reminder templates editable by the company, WhatsApp/push, alerting on repeated send failures, a job queue, and
everything in Phases 7–8.

---

## 12. Stop conditions

* Phase 3–5 are not in `main`, or baseline gates fail before you start.
* The unique index cannot be created because existing reminder rows are duplicates — stop, report the conflict, and
  propose a data-cleaning migration for owner approval instead of silently deleting rows.
* `reminder_status` cannot be altered (e.g. a different enum definition exists) — adapt with `add column if not exists`
  and report precisely what you changed instead of recreating the type destructively.
* No Resend credentials and no DB access → implement fully, then report `SECURITY CHECK: UNVERIFIED`,
  delivery **unverified**, and `SAFE TO MERGE: NO` with the owner's exact verification steps.

---

## 13. Phase completion report

Finish with the standard report from `/prompts/README.md` §6. Required specifics: the dedupe evidence (two runs, row
counts), the window/cadence rule you implemented (state it explicitly), cron auth results, whether real emails were
sent or delivery is unverified, the migration state, the isolation test result, and an honest `SAFE TO MERGE`.
