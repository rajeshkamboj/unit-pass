# PHASE 7 — Stripe Billing, Trials and Usage Limits

**Branch:** `phase/07-billing` (from the latest `main`; **verify Phases 1–6 are merged**)
**Prerequisites:** Phases 1–6 merged into `main`. /prompts/README.md read in full.
**Depends on:** Phase 1 (companies/tenancy), Phase 2 (Settings), Phase 3 (equipment creation server action — the limit
seam).
**Blocks:** Phase 8 (production readiness review).

---

## 1. Objective

Charge HVAC companies for UnitPass: three plans with active-equipment limits, a 14-day trial, Stripe Checkout to
subscribe, a Customer Portal to manage/cancel, and **server-side** enforcement of usage limits — with subscription
state coming only from verified Stripe webhooks, never from the browser.

Hard product rules for this phase:

* **Public UnitPass pages never stop working because of billing.** A lapsed subscription must never break a printed
  QR code.
* Plans/prices are **configuration-driven**, not sprinkled through components.
* No billing analytics, no invoicing screens, no tax engine, no metering.

---

## 2. Preconditions and branch setup

```bash
git status && git fetch origin --prune
git checkout main && git pull --ff-only origin main
git log --oneline -30                     # Phases 1–6 must be present
ls src/app/dashboard/equipment            # Phase 3 surface (creation seam) must exist
git checkout -b phase/07-billing
git push -u origin phase/07-billing

pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm build  # green before you start
```

If Phase 6 is not in `main`: stop and report.

---

## 3. Scope

### 3.1 Plans (single source of truth)

`src/lib/billing/plans.ts` exports the plan catalogue:

| Plan id | Display | Price | Active equipment limit | Stripe price env var |
|---|---|---|---|---|
| `starter` | STARTER | $29/month | 100 | `STRIPE_PRICE_STARTER` |
| `growth` | GROWTH | $59/month | 500 | `STRIPE_PRICE_GROWTH` |
| `pro` | PRO | $99/month | 2,000 | `STRIPE_PRICE_PRO` |

Also export: `TRIAL_DAYS = 14`, `TRIAL_PLAN = 'growth'` (trial entitlement; one-line config change),
`LAPSED_LIMIT = 0` (no new records once lapsed) and helpers `getPlan(planId)`, `getPlanByPriceId(priceId)`,
`getPlanLimit(planId)`.

Rules: no price, plan name or limit is hardcoded anywhere else (the landing page and billing UI import this module);
prices are **display strings** ("$29/month") while the authoritative amount lives in Stripe; a missing price env var
must degrade gracefully (billing UI shows "Billing is not configured yet", checkout returns 503) instead of crashing.

### 3.2 Subscription state (database)

Use the existing `subscriptions` table and add:

* `stripe_price_id text` (which plan is actually subscribed)
* `stripe_customer_id text` (already exists — keep, fill from webhooks)
* `trial_ends_at timestamptz` (mirrors the company trial for convenience; nullable)
* `updated_at timestamptz not null default now()` + trigger (may already exist)
* unique constraint on `stripe_subscription_id` (exists in the legacy schema — verify)
* indexes: `subscriptions(company_id)`, `subscriptions(status)`

Company-level trial (authoritative before any subscription):

* `companies.trial_ends_at timestamptz not null default (now() + interval '14 days')` — backfill existing rows,
  then keep the default; and set it explicitly inside `create_company_with_owner()` for new companies
  (`drop function`/`create function` with the same signature, or simply rely on the column default — prefer the
  column default so the RPC does not need to change).
* `companies.stripe_customer_id text unique` — created lazily at first checkout.

Stripe event log (for webhook idempotency):

* `create table if not exists public.stripe_events (id text primary key, type text not null, processed_at timestamptz not null default now());`
  with RLS enabled and **no policies** (service-role only).

RLS: `subscriptions` — `select` for `public.is_company_member(company_id)`; **no insert/update/delete policies for
authenticated users** (only webhooks, via the server-only admin client, may write). Explicitly consider dropping the
legacy "Members can insert/update/delete subscription" policies from `supabase/schema.sql` if they exist —
`drop policy if exists "Members can insert subscription for their company" on public.subscriptions;` etc.
`stripe_events`: RLS enabled, no policies, `revoke all from anon, authenticated`.

### 3.3 Entitlements (server-side, never client-trusted)

`src/lib/billing/entitlements.ts` (server-only):

```ts
type EntitlementState = 'trialing' | 'active' | 'past_due' | 'lapsed' | 'none';
type Entitlements = { state, planId, limit, equipmentUsed, canCreateRecords, trialEndsAt, currentPeriodEnd };
```

Resolution rules (implement exactly, document in comments):

1. Load the company's newest subscription row (server-side) and the company's `trial_ends_at`.
2. If a subscription is `Active` or `Trialing` → state `active`, plan from `stripe_price_id` (fallback: `plan` column),
   limit from the plan.
3. Else if `current_period_end > now()` while `cancel_at_period_end = true` → still `active` (cancelled but paid).
4. Else if `status = 'Past Due'` → `past_due` (keep writes enabled, show a payment-warning banner).
5. Else if `trial_ends_at > now()` → `trialing`, plan = `TRIAL_PLAN`, limit = that plan's limit.
6. Else → `lapsed`, `limit = 0`, `canCreateRecords = false`.
7. "Equipment used" = count of the company's equipment rows with `status <> 'Replaced'` (document this definition in
   the UI: "active equipment records = records not marked Replaced").

Enforcement points (server-side only):

* **Equipment creation** (the Phase 3 server action): before inserting, resolve entitlements and reject with a clear
  message ("Your plan allows 100 active equipment records. Upgrade to add more.") when
  `equipmentUsed >= limit`. Return a structured error the UI can render with an upgrade link.
* Optional and cheap: also block the same in any other new-record path if one exists (there is none for equipment in
  this phase). Do **not** block: reads, edits, service records, documents, reminders, or any public page.
* Show usage on the dashboard (e.g. "142 / 500 active equipment records") and on the Billing page with a progress bar
  (shadcn `Progress`).

### 3.4 Checkout, portal, cancellation

* `POST /api/stripe/checkout` (route handler) — requires an authenticated session; resolves the company server-side;
  body: `{ planId }` validated against the catalogue; returns/redirects to a Stripe Checkout Session:
  * `mode: 'subscription'`, one line item with the plan's price id,
  * reuse/create the Stripe customer (`companies.stripe_customer_id`), attach `metadata.company_id` and
    `subscription_data.metadata.company_id`, `client_reference_id: company_id`,
  * `success_url: ${NEXT_PUBLIC_SITE_URL}/dashboard/billing?checkout=success`,
    `cancel_url: ${NEXT_PUBLIC_SITE_URL}/dashboard/billing?checkout=cancelled`,
  * do not add `trial_period_days` (the 14-day trial is app-side and already counted) — but document that the owner may
    enable a Stripe trial instead if they prefer; never grant two trials.
* `POST /api/stripe/portal` (route handler) — creates a Billing Portal session for the company's Stripe customer with
  `return_url` set to `/dashboard/billing`. Cancellations and plan changes happen in the Portal (the Stripe Dashboard
  must be configured to allow the relevant plan-switching — document that owner step).
* Billing page `/dashboard/billing`:
  * current plan/state, trial days remaining or renewal date, usage (X of Y, progress bar), payment-warning banner for
    `past_due`, and a clear statement: "Cancelling never breaks your customers' public UnitPass pages — they keep
    working. You just can't add new equipment until you resubscribe."
  * plan cards from `plans.ts` (select → checkout for new subscriptions; "Manage billing" → portal once subscribed),
  * a "Billing is not configured" state when price env vars are missing.
* Nav: add **Billing** last (README §11 order).

### 3.5 Webhooks (mandatory verification, idempotent)

`src/app/api/webhooks/stripe/route.ts`:

* `export const runtime = 'nodejs'`; read the **raw body** (`const body = await req.text()`);
  `stripe.webhooks.constructEvent(body, req.headers.get('stripe-signature'), STRIPE_WEBHOOK_SECRET)`.
  Missing/invalid signature → **400** (never process).
* Idempotency: `insert into stripe_events (id, type) values (event.id, event.type) on conflict do nothing` —
  if the insert affected 0 rows, return 200 immediately (already processed).
* Handle at minimum:
  * `checkout.session.completed` → resolve `company_id` (metadata/client_reference_id), store the Stripe customer id on
    the company if missing, and (if the session has a subscription) let the subscription events write the row.
  * `customer.subscription.created` / `updated` → upsert the `subscriptions` row by `stripe_subscription_id` with
    `company_id` from metadata, `plan` mapped from `stripe_price_id` (via `getPlanByPriceId`), status mapped to the
    enum (`active`→`Active`, `trialing`→`Trialing`, `past_due`→`Past Due`, `canceled`→`Canceled`,
    `incomplete`→`Incomplete`, `incomplete_expired`→`Incomplete Expired`, `unpaid`→`Past Due`), period bounds
    (convert Stripe unix seconds → timestamptz), `cancel_at_period_end`, `stripe_price_id`.
  * `customer.subscription.deleted` → status `Canceled` (keep the row for history).
  * `invoice.payment_failed` → mark the matching subscription `Past Due` (and nothing else).
* Unknown but verified event types → log and return 200.
* Use the **server-only admin client** (bypasses RLS — required, since authenticated users have no write policy).
* Return 500 only for genuine processing failures (so Stripe retries); never leak internals in the response.
* Document local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` with test keys.

### 3.6 Cancellation / lapse behaviour (product rules)

* Cancelled-but-paid-up (`cancel_at_period_end`) → normal access until `current_period_end`.
* `Canceled` after the period ends, or trial expired with no subscription → **lapsed**:
  * all reads, exports and public pages keep working;
  * creating **new** equipment is blocked with an upgrade prompt;
  * show a non-destructive banner in the dashboard with a "Reactivate" CTA (checkout/portal);
  * never delete or hide existing data, never break `/p/[token]`.
* `past_due` → allow writes + prominent payment-warning banner.

---

## 4. Explicit exclusions

Invoices/receipts UI, tax handling (Stripe Tax is an owner-side option — do not implement), coupons/promo codes,
multi-seat/team billing, annual plans and self-serve plan switching UI beyond the Portal, usage-based metering,
overage charges, dunning emails (Stripe handles payment recovery), revenue analytics/dashboards, affiliate/referral
programs, **homeowner payments (explicitly prohibited product-wide)**, and everything in Phase 8.

---

## 5. Database and migration requirements

New idempotent migration, e.g. `supabase/migrations/20261119000001_phase7_billing.sql`:

1. `subscriptions` — `add column if not exists` for `stripe_price_id`, `trial_ends_at`, `updated_at`
   (+ `set_updated_at` trigger), verify/create `unique (stripe_subscription_id)` and the indexes in §3.2.
   If the legacy enum values differ, adapt with `add column`/mapped text rather than recreating the enum destructively.
2. `companies` — `add column if not exists stripe_customer_id text unique;`
   `add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days');`
   then `update public.companies set trial_ends_at = now() + interval '14 days' where trial_ends_at is null;`
   (idempotent backfill — no data loss).
3. `stripe_events` as in §3.2 + `revoke all ... from anon, authenticated`.
4. RLS changes on `subscriptions`: enable (if not already), keep/replace the member `select` policy via
   `public.is_company_member(company_id)`, and **drop the legacy authenticated insert/update/delete policies** if they
   exist. `revoke all on public.subscriptions from anon;` grant `select` to `authenticated`.
5. No change to the public UnitPass RPC in this phase (public pages are billing-independent by design).

Append a Phase 7 section to `supabase/tests/rls_tenant_isolation.sql`:
* A can `select` its own subscription row and **cannot** see B's;
* A **cannot** insert/update/delete subscription rows (no policy → 0 rows / error);
* `anon` cannot read `subscriptions` or `stripe_events`;
* `is_company_member` still gates company reads (regression check).

---

## 6. Security requirements

1. **Webhook signature verification is mandatory**; unsigned/invalid requests are rejected with 400 and never touch
   the database. Prove it with `curl` (no signature → 400).
2. **Subscription state is never trusted from the client**: the UI may display it, but entitlement decisions are made
   server-side from the DB (written by verified webhooks) — never from a query param, cookie, or client state.
3. Usage limits are enforced **server-side** in the write path; hiding a button is not enforcement.
4. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are server-only; the service-role key stays server-only
   (`import 'server-only'` modules).
5. Webhook idempotency via `stripe_events` (replay-safe); handle Stripe retries without duplicating subscription rows
   (upsert by `stripe_subscription_id`).
6. No secret or internal error detail appears in API responses; log server-side only.
7. Public UnitPass pages remain accessible and unchanged regardless of billing state — assert this manually after
   forcing a lapsed state.
8. `.env*` untracked; new variable names in `.env.example` only; test-mode keys must never be committed either.

---

## 7. Acceptance criteria

* [ ] `pnpm typecheck && pnpm lint && pnpm build` pass.
* [ ] `plans.ts` is the only place plans/prices/limits are defined; a missing price env var degrades gracefully.
* [ ] Billing page shows correct state for: trialing company, active subscriber, `past_due`, cancelled-at-period-end,
      and lapsed.
* [ ] Trial: a new company gets 14 days, sees `TRIAL_PLAN` limits and days remaining; after `trial_ends_at` passes
      (simulate by updating the DB row), new equipment creation is blocked with an upgrade CTA while existing data and
      public pages still work.
* [ ] Limit enforcement: with limit N, the N+1-th **new** active equipment record is rejected server-side; the N-th is
      allowed; editing an existing record is never blocked; equipment marked `Replaced` frees capacity.
* [ ] Checkout: with test keys, selecting a plan opens Stripe Checkout and, after completing with a test card, the
      webhook writes an `Active` subscription row and the UI reflects it (or is documented as owner-verifiable).
* [ ] Portal: "Manage billing" opens the Stripe Customer Portal for the company's customer.
* [ ] Cancelling (via Portal or by simulating `customer.subscription.deleted`) → row `Canceled`; access behaviour
      matches §3.6; public `/p/{token}` still returns 200.
* [ ] Webhook security: valid signature → processed; invalid/missing signature → 400; a replayed event id → 200 with no
      duplicate row.
* [ ] RLS/limits tests: Company A cannot read/modify B's subscription; `anon` cannot read `subscriptions`/`stripe_events`.
* [ ] Sidebar shows Dashboard, Customers, Equipment, Services, Documents, Settings, Billing.
* [ ] No billing analytics, invoices UI, or homeowner payments were built.

---

## 8. Tests and verification

```bash
pnpm typecheck && pnpm lint && pnpm build

# local webhook testing (owner/agent with Stripe test keys)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed

# webhook security (no signature)
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhooks/stripe -d '{}'   # 400

# database
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<phase7>.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql

# entitlement sanity (SQL)
psql "$SUPABASE_DB_URL" -c "select id, trial_ends_at, stripe_customer_id from public.companies order by created_at desc limit 5;"
```

Manual matrix (record pass/fail):

| # | Test | Expected |
|---|---|---|
| 1 | New company dashboard | trial banner with days remaining; usage shows the trial limit |
| 2 | Create equipment up to the trial limit, then one more | the extra record is rejected with an upgrade prompt |
| 3 | Mark an old record `Replaced` | capacity frees up; creation allowed again |
| 4 | Select STARTER → Stripe Checkout (test mode, card 4242…) | returns to billing page with an active subscription |
| 5 | `stripe trigger customer.subscription.deleted` | state becomes lapsed/cancelled; public passport still loads |
| 6 | Replay the same webhook event | no duplicate subscription rows, 200 |
| 7 | POST a forged webhook body without a signature | 400, nothing written |
| 8 | Company B's subscription is invisible to Company A | confirmed via SQL test |
| 9 | Missing `STRIPE_PRICE_*` in env | billing page shows "not configured"; no crash |
| 10 | 375 px viewport on the billing page | readable, cards usable |

---

## 9. Environment variables and external services

Add to `.env.example` (names only): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`,
`STRIPE_PRICE_GROWTH`, `STRIPE_PRICE_PRO` (optionally `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` only if client-side
Stripe.js is actually used — it is not required by this design).

New dependency: **`stripe`** (server SDK).

Owner configuration required (document in `README.md`): Stripe account; create the three products/prices in the
dashboard (matching $29/$59/$99 monthly); copy the price IDs into env; create the webhook endpoint
`https://<domain>/api/webhooks/stripe` for the events listed in §3.5 and copy the signing secret; configure the
Customer Portal (allowed payment methods, plan switching, cancellation); decide test-mode vs live-mode keys per
environment.

---

## 10. Files expected to change (guide)

Added: `supabase/migrations/<phase7>.sql`, `src/lib/billing/plans.ts`, `src/lib/billing/stripe.ts` (server client),
`src/lib/billing/entitlements.ts`, `src/lib/billing/usage.ts`, `src/app/api/stripe/checkout/route.ts`,
`src/app/api/stripe/portal/route.ts`, `src/app/api/webhooks/stripe/route.ts`,
`src/app/dashboard/billing/page.tsx` (+ plan cards/client bits).

Modified: the equipment creation server action (limit check), `src/app/dashboard/page.tsx` (usage line/banner),
`src/app/dashboard/settings/*` (billing-aware copy if needed), `src/components/Sidebar.tsx` (Billing),
`src/app/page.tsx` only if it must import plan prices from `plans.ts` (Phase 8 owns the landing page),
`supabase/tests/rls_tenant_isolation.sql` (Phase 7 section), `.env.example`, `package.json` + `pnpm-lock.yaml`,
`README.md`, `prompts/README.md` (decisions log row only).

---

## 11. Deferred (record under FUTURE PHASE NOTES)

Annual pricing, coupons, per-seat pricing, invoices/receipts UI, tax handling, dunning customisation, overage
charges, usage-based metering, plan-switch proration UI beyond the Portal, billing notifications, and enterprise
contracts.

---

## 12. Stop conditions

* Phase 6 is not in `main`, or baseline gates fail before you start.
* Legacy subscription policies cannot be replaced without destroying data.
* No Stripe test keys are available → implement everything, document owner setup, and report billing as
  **unverified** (`SECURITY CHECK: UNVERIFIED` for the webhook/checkout paths) with `SAFE TO MERGE: NO` unless the
  rest of the phase is provably correct.
* Any design idea that would block public UnitPass pages on billing state — reject it; the QR must always work.

---

## 13. Phase completion report

Finish with the standard report from `/prompts/README.md` §6. Required specifics: the plan configuration and where
limits live; the exact limit-enforcement evidence (which record number was rejected); webhook signature test results
(400 for unsigned) and replay/idempotency evidence; how entitlement states were verified (test keys, simulated rows, or
unverified); confirmation that public pages survive a lapsed subscription; and an honest `SAFE TO MERGE`.
