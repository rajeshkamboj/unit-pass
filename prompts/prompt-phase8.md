# PHASE 8 — Landing Page, Onboarding, Security Review, Testing and Production Readiness

**Branch:** `phase/08-production` (from the latest `main`; **verify Phases 1–7 are merged**)
**Prerequisites:** Phases 1–7 merged into `main`. /prompts/README.md read in full.
**Depends on:** everything. **Blocks:** launch (owner-controlled).

---

## 1. Objective

Make UnitPass **launch-ready**: a convincing public landing page, a first-run onboarding checklist, a full
end-to-end QA pass (including security and mobile), honest cleanup of dead code and dependencies, and a `README.md`
that lets the owner deploy and operate the product without further agent input.

**No new product features.** This phase hardens, verifies, documents and finishes.

---

## 2. Preconditions and branch setup

```bash
git status && git fetch origin --prune
git checkout main && git pull --ff-only origin main
git log --oneline -40                  # all seven phases must be visible
ls src/app/dashboard/{customers,equipment,services,documents,settings,billing}
ls src/app/p
git checkout -b phase/08-production
git push -u origin phase/08-production

pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm build     # must be green before you start
```

If any phase is missing from `main`: stop and report exactly which functionality is absent. Do not re-implement
earlier phases here (that is a separate fix and must be called out as a regression).

---

## 3. Scope

### 3.1 Landing page (public)

Rebuild/polish `src/app/page.tsx` on top of the existing copy (hero, problem, how-it-works, benefits, pricing, FAQ,
CTA), with the required positioning:

* **Product name:** UnitPass
* **Positioning line:** **"The Digital Service Passport for HVAC Equipment."**
* **Primary commercial message:** **"Turn Every Installation Into Repeat Service Revenue."**
* Explain the loop in five steps (numbered, scannable):
  1. Add equipment
  2. Generate QR
  3. Attach the QR label to the system
  4. Customer scans for warranty/service information
  5. HVAC company knows when service is due
* Pricing section must import plan names/prices/limits from `src/lib/billing/plans.ts` (Phase 7) — no duplicated
  numbers. Include the 14-day trial message only if it matches the implemented behaviour (trial is app-side,
  14 days).
* CTAs: "Start free trial" → `/auth/sign-up`; "Sign in" → `/auth/sign-in`. Never link to `/dashboard` for
  unauthenticated visitors expecting a working app.
* FAQ should answer the real questions honestly: data security/tenant isolation, what happens to QR codes if I cancel
  (they keep working), do homeowners need an account (no), what's included per plan, how reminders reach me.
* Keep it fast: Server Component, no carousels/animation libraries, no stock images that do not exist
  (`public/` currently lacks `hero.jpg` and `how-it-works.svg` — either add real lightweight assets or remove the
  references; **no broken images**), a mobile-first layout at 375 px, and semantic HTML with proper heading order.
* Metadata: title/description/OG tags, `viewport`, canonical URL from `NEXT_PUBLIC_SITE_URL`.
* Footer: product name, contact placeholder (owner-provided), privacy/terms links only if those pages exist
  (do not link to nonexistent pages; if they do not exist, state that in the report as an owner action item).

### 3.2 Onboarding checklist (first-run experience)

* A dismissible checklist on `/dashboard` for a company that has not completed the first-run steps:
  1. **Add your first customer**
  2. **Add your first equipment record**
  3. **Generate a QR code**
  4. **View a customer's UnitPass**
  5. **Set a next service date**
* Derive completion states from data where possible (customer count > 0; equipment count > 0; a next_service_date
  exists). For actions that cannot be derived (QR generated, UnitPass viewed) store an explicit timestamp:
  `companies.onboarding_qr_generated_at`, `companies.onboarding_unitpass_viewed_at`, plus
  `companies.onboarding_dismissed_at`.
* Link each step to the right route (customer create, equipment create, QR page, public page of the company's newest
  equipment, equipment edit/service date).
* Hide the checklist when all steps are complete or dismissed; never block the dashboard behind it.
* Fetch the data in one server-side pass (no client waterfalls), and keep the UI mobile-friendly.

### 3.3 Full application review and QA matrix

Run the complete test matrix below, recording pass/fail per row with evidence (command output, screenshot path,
or a precise description). Where a check needs credentials that are unavailable, mark it **UNVERIFIED** and list the
owner's exact verification steps — do not mark it passed.

| Area | Checks |
|---|---|
| Authentication | sign-up, email confirmation, sign-in, sign-out, forgot/reset password, invalid credentials, expired link, duplicate email |
| Authorization | dashboard routes redirect when unauthenticated (server-side + middleware); no route relies on client-only guards |
| Tenant isolation | Company A cannot read/write Company B (customers, equipment, service records, documents, reminders, subscriptions); forged `company_id` in requests is rejected; SQL isolation test passes |
| Customer CRUD | create/view/edit/search/archive/unarchive; validation; empty states; 404 for unknown ids |
| Equipment CRUD | create/edit/list/filter/search; customer ownership validation; status transitions; no hard delete |
| QR generation | QR renders, encodes `${NEXT_PUBLIC_SITE_URL}/p/{token}`, PNG download, printable label, token immutable after edits |
| Public UnitPass | unknown token 404s; Active/Inactive/Replaced render correctly; Book Service works with URL and without; noindex; fast on mobile; no internal ids/PII/private notes |
| Public/private separation | seeded markers (`installer_notes`, private service notes, private document names, customer PII) absent from public HTML/JSON and from signed-URL-less storage access |
| Service history | create/edit/delete records; Mark Serviced recalculates next date; month-end math; filters (7/30/60/overdue); public history shows public fields only |
| Documents | upload type/size/signature validation; public docs on UnitPass; private docs unreachable anonymously; visibility toggle; delete removes object |
| Reminder logic | windows 30/7/overdue; no duplicates across runs; `reminders_enabled = false` sends nothing; failed sends recorded; cron requires the secret |
| Stripe webhooks | unsigned → 400; valid signature → processed; replayed event → idempotent; subscription state written server-side only |
| Subscription limits | trial limits enforced; N+1 record rejected server-side; `Replaced` frees capacity; lapsed state blocks writes but public pages still work |
| Mobile responsiveness | 375 px pass over landing, auth, dashboard, customers, equipment, QR, services, documents, settings, billing, and the public UnitPass |
| Error states | invalid ids (404), validation failures, network/storage failures, Stripe not configured, Resend not configured |
| Empty states | new company with no customers/equipment/documents/reminders; no service due; filtered lists with no matches |
| Loading states | list/detail/form submissions show progress; no layout shift disasters; server actions disable buttons while pending |
| Accessibility basics | semantic landmarks/headings, labels tied to inputs, focus-visible styles, contrast, alt text, keyboard-operable menus/dialogs, no color-only status |
| Performance sanity | public UnitPass ships minimal/no client JS; landing page has no heavy dependencies; no obvious N+1 query patterns on the dashboard |

### 3.4 Dead code, dependencies and environment review

* **Dead code:** remove only what is provably unused (grep first, then delete):
  * any leftover Vite/Dyad files still present (the Phase 1 list in `/prompts/README.md` §1.5),
  * components/modules with zero imports,
  * `console.log` debug noise and commented-out blocks in touched files.
* **Keep** the unused shadcn UI components in `src/components/ui/` (removing them adds risk and no launch value) —
  state this decision in the report.
* **Dependencies:** verify each suspect with `grep -rn "<pkg>" src app` before removing. Known suspects from the audit
  (verify again): `@hookform/resolvers`, `@tailwindcss/typography`, `embla-carousel-react`, `input-otp`, `cmdk`,
  `vaul`, `react-resizable-panels`, `recharts`, `@radix-ui/*` used only by unused components, `eslint-plugin-react-refresh`,
  `typescript-eslint`, `@eslint/js`, `globals`, `react-day-picker` (should not be installed).
  Only remove what is truly unused **and** not needed by an immediately planned owner request; every removal must be
  listed in the report. Do not remove: `next`, `react`, `react-dom`, `@supabase/*`, `stripe`, `resend`, `qrcode`,
  `zod`, `date-fns`, `tailwindcss`, `typescript`, `eslint*`, `@types/*`, `class-variance-authority`, `clsx`,
  `tailwind-merge`, `tailwindcss-animate`, `lucide-react`, `sonner`, `@tanstack/react-query` **only if actually
  used** (remove it if nothing imports it and note it).
* After any removal: `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm build` must still pass.
* **Environment variables:** audit every `process.env` usage; confirm `.env.example` lists every name with a comment;
  confirm no secret is read in a client module and no secret has a `NEXT_PUBLIC_` prefix; confirm `.env*` is untracked;
  scan the whole history for accidentally committed secrets (`git log --all -p -- .env .env.local` and
  `git grep -nE "sk_live_|sk_test_|service_role|re_[A-Za-z0-9]{10,}" $(git rev-list --all) -- 2>/dev/null | head`) and
  report anything found (do not "fix" history; tell the owner to rotate the key).

### 3.5 README and operational documentation

Rewrite `README.md` as a production-grade document:

1. What UnitPass is (one paragraph) and the core loop.
2. Architecture summary (Next.js App Router, Supabase, Stripe, Resend, Vercel) and where things live.
3. Local development: prerequisites (Node 22, pnpm via corepack), install, `.env.local` from `.env.example`, run,
   verification commands (`typecheck`, `lint`, `build`), how to run the SQL tests.
4. Supabase setup: project, applying migrations (CLI or SQL editor), auth URL configuration (site URL, redirect URLs
   for callback + reset), email confirmation decision, storage buckets (`documents`, `equipment-photos`, optional
   `company-assets`) with the exact policies/size limits, service-role key handling.
5. Stripe setup: products/prices for the three plans, price IDs into env, webhook endpoint + events + secret,
   Customer Portal configuration, test-mode vs live-mode.
6. Resend setup: API key, verified sending domain (or the test sender), `RESEND_FROM_EMAIL`.
7. Vercel deployment: import the repo, env vars per environment, cron (`/api/cron/reminders` + `CRON_SECRET`), build
   settings, and that `NEXT_PUBLIC_SITE_URL` must be the real domain **before printing QR labels**.
8. Operations: how to run the reminder job manually, where to see delivery history, how to check RLS, backup/rollback
   notes, free-tier limits.
9. Troubleshooting: common failures (missing env vars, auth redirect URL mismatch, storage policy denial, Stripe
   webhook 400, cron 401).
10. The phase/branch workflow (`/prompts/README.md`) so future sessions find it.

### 3.6 Production readiness review

* `public/robots.txt`: allow the landing page, **disallow** `/dashboard`, `/auth`, `/api`, `/p/` (passports stay out of
  search engines; they are also `noindex`).
* Add a friendly `not-found` page for the app (and confirm the public token 404 does not leak data).
* Confirm no `console.log` of sensitive data, no `TODO`/`FIXME` left in shipped paths (list any that remain).
* Confirm the build works with production-style env values (and that the app fails fast with a clear message when a
  required variable is missing).
* Cost/limits awareness: note Supabase free-tier storage/database limits, Resend quota, Vercel cron plan limits, and
  Stripe fees in the README (brief).
* Security summary in the README: tenant isolation model, public token model, private document model, secret handling,
  webhook verification, cron secret.
* Owner action items: list everything that still requires human configuration (domain, DNS, legal pages, support
  email, Stripe live keys, Resend domain, Supabase production project, backups) — this becomes the launch checklist.
* Do **not** merge to `main`, do not tag `main`, do not deploy. Recommend the owner's next steps (merge →
  production env → smoke test in production → print first label with the correct `NEXT_PUBLIC_SITE_URL`).

---

## 4. Explicit exclusions

New features of any kind (including analytics, chat widgets, cookie banners, blog/CMS, testimonials, case studies,
video, multi-language, dark-mode toggle, team seats, notifications UI, exports). No redesign of the dashboard.
No new pricing tiers or annual plans. No new third-party services. No marketing automation or email campaigns.
No legal document drafting beyond linking (the owner provides privacy/terms text).

---

## 5. Database and migration requirements

One small idempotent migration, e.g. `supabase/migrations/20261126000001_phase8_onboarding.sql`:

* `companies`: `add column if not exists onboarding_qr_generated_at timestamptz;`
  `add column if not exists onboarding_unitpass_viewed_at timestamptz;`
  `add column if not exists onboarding_dismissed_at timestamptz;`
* No other schema changes. Do not "tidy" columns or indexes in this phase.
* If the onboarding flags are written from the app, they must be written via Server Actions scoped to the caller's
  company (RLS-protected `update` on `companies` already allows members/admins per Phase 1 — verify the policy allows
  it; if only admins may update the company, either use that or add a narrowly-scoped policy. Do not loosen policies
  without reporting it).

Append a Phase 8 section to `supabase/tests/rls_tenant_isolation.sql` only if new behaviour needs coverage
(e.g. onboarding flag update cannot touch another company).

---

## 6. Security requirements

1. Re-run every earlier security test and paste the results (no "looks fine").
2. Confirm `anon` has **no** table privileges anywhere in `public` (query `pg_class`/`pg_policies` and record the
   output) and that the only anonymous access paths are the public RPC(s) and the public document redirect route.
3. Confirm RLS is enabled on every tenant table (run `supabase/tests/check_rls_enabled.sql`).
4. Confirm the service-role key is imported only in server-only modules; grep the built client bundles for
   `service_role` if practical.
5. Confirm webhook + cron endpoints reject unauthenticated calls (prove with `curl`).
6. Confirm no secrets are committed and no `.env*` file is tracked.
7. Confirm public pages expose only the whitelisted fields (re-run the seeded-marker greps for `installer_notes`,
   private service notes, private document names, customer PII, internal ids).
8. Document the residual risks you know about (e.g. no antivirus scanning on uploads, no rate limiting on public
   pages, Supabase free-tier limits) in `KNOWN ISSUES`.

---

## 7. Acceptance criteria

* [ ] `pnpm typecheck && pnpm lint && pnpm build` pass on a clean install.
* [ ] Landing page contains the required positioning and 5-step explanation, links correctly, has no broken images,
      no duplicate pricing values (imports `plans.ts`), and is mobile-correct at 375 px.
* [ ] Onboarding checklist works, persists dismissal, computes step states correctly for a fresh and a completed
      company, and never blocks the dashboard.
* [ ] The QA matrix in §3.3 is filled in with pass/fail/UNVERIFIED and evidence for every row.
* [ ] Every UNVERIFIED item is listed with the exact owner step required to verify it.
* [ ] Dead code removed only where provably unused; every removal listed; keep the shadcn kit with a stated reason.
* [ ] Dependency removals listed with the grep evidence; build/lint/typecheck pass afterwards.
* [ ] `.env.example` is complete; no secret is client-exposed; history scan reported (clean or rotation advice).
* [ ] `README.md` covers §3.5 in full, including the launch checklist and troubleshooting.
* [ ] `robots.txt` updated; app 404 page exists; public token 404 leaks nothing.
* [ ] Security summary re-run and recorded (RLS enabled, anon privileges, cron/webhook auth, public whitelist).
* [ ] No new features were implemented; no schema "tidying"; no merge to `main`; no deployment performed.
* [ ] The completion report states clearly whether the app is safe to merge **and** what remains owner-only.

---

## 8. Tests and verification

```bash
# clean-slate verification
rm -rf node_modules .next   # optional; `pnpm install --frozen-lockfile` is a legitimate alternative
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm build

# security re-checks
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/check_rls_enabled.sql
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/webhooks/stripe -d '{}'      # 400
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/reminders                        # 401
curl -s http://localhost:3000/p/<token> | grep -ci "PRIVATE_\|installer_notes\|customer@example.com"     # 0
git ls-files | grep -E '^\.env' || echo "no env files tracked"
git grep -nE "sk_live_|sk_test_|service_role" -- src app | head

# mobile/perf sanity (manual or Lighthouse if available)
# - 375 px sweep across all routes
# - public UnitPass: no heavy client JS, fast first paint on a throttled connection
```

The §3.3 QA matrix is the authoritative test list for this phase: fill it in row by row in the completion report
(summarised; the full matrix can live in the final message or an attached notes file inside the branch —
**no new docs beyond `README.md` unless the owner asked**, so prefer the report itself).

---

## 9. Environment variables and external services

No new variables. Verify the complete registry (README §10) is accurate, `.env.example` matches it, and each variable
is documented with where to obtain it and which environment(s) need it.

Owner-only items that must be listed as an explicit launch checklist:

* production Supabase project (migrations applied, auth URLs, buckets, storage policies)
* Vercel project linked with production env vars + cron + `CRON_SECRET`
* Stripe live-mode products/prices, webhook endpoint + signing secret, portal configuration
* Resend verified domain and sender
* `NEXT_PUBLIC_SITE_URL` set to the production origin **before** printing QR labels
* domain/DNS, support email, privacy/terms content, backups/PITR decision
* a first-account production smoke test (sign up → company → customer → equipment → QR scan → public page →
  mark serviced → reminder run)

---

## 10. Files expected to change (guide)

Added: `supabase/migrations/<phase8>.sql`, onboarding checklist components, an app `not-found.tsx` (if missing),
possibly lightweight `public/` assets, updated `robots.txt`.

Modified: `src/app/page.tsx` (landing), `src/app/dashboard/page.tsx` (checklist), `src/app/dashboard/**` (states and
polish only), `src/app/p/[token]/page.tsx` (states/polish only), `README.md` (major rewrite), `package.json` +
`pnpm-lock.yaml` (removals only), `.env.example`, `prompts/README.md` (decisions log row only).

---

## 11. Deferred (record under FUTURE PHASE NOTES)

Everything not required for launch that you noticed: analytics, marketing site expansion, legal pages content,
in-app notifications, exports, annual plans, team seats, homeowner reminders, upload scanning, rate limiting,
audit logs, and any structural refactors.

---

## 12. Stop conditions

* Any phase is missing from `main`, or the baseline gates fail before you start (report the regression; do not
  silently fix another phase's feature).
* A "cleanup" would require rewriting working code (stop; the phase is hardening, not refactoring).
* Security re-checks fail: **do not** paper over them, do not merge; report the failure precisely, with the evidence
  and the proposed fix, and set `SAFE TO MERGE: NO`.
* Deployment/merge is requested implicitly — the agent never merges or deploys.

---

## 13. Phase completion report

Finish with the standard report from `/prompts/README.md` §6. This report must additionally include:

* the §3.3 QA matrix summarised with pass/fail/UNVERIFIED per area;
* the exact security re-check commands and results;
* the list of removed dead code/dependencies with evidence, and what was deliberately kept (e.g. shadcn kit);
* the launch checklist for the owner (owner-only configuration and the production smoke test);
* residual risks under `KNOWN ISSUES`;
* `SAFE TO MERGE` plus a plain-language "what to do next" for the owner.
