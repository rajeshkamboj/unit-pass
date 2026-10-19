# Phase 5 — implementation and verification handoff

Date: 2026-10-19. Branch: `arena/820f9714-unit-pass` (Arena session branch, not `phase/05-documents`).
Based on `origin/main` at `c6ca024`, which contains Phases 1–4.

**Implementation is ready for owner verification, not approved for merging.** No Supabase project URL, anon key,
service-role key or database connection was available in this session. No live Supabase migration was applied.
`SECURITY CHECK: UNVERIFIED` / `SAFE TO MERGE: NO` until the live checks below pass.

## Checks executed

| Check | Result / scope |
|---|---|
| `pnpm install --frozen-lockfile` | PASS; no dependency or lockfile changes |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | PASS before implementation and after implementation |
| `pnpm verify:documents` | PASS: 13 focused checks, including the four signatures, invalid extensions/MIME, zero/20 MB rejection, filename/path safety, strict public whitelist, upload compensation, partial delete, tenant scoping, visibility acknowledgement and 404/307 route contracts. **Storage/auth I/O is mocked.** |
| `pnpm verify:dates` | PASS: 12 existing Phase 4 regression checks |
| Phase 1–5 migrations on disposable **PostgreSQL 17.6** | PASS with `local/postgres_shim.sql` + `local/storage_shim.sql`; Phase 5 also reapplied successfully |
| `supabase/tests/rls_tenant_isolation.sql` | PASS locally, all Phases 1–5; `PASS: 5.1` through `PASS: 5.10`, final `ALL CHECKS PASSED … Phase 5 tenant isolation`, ROLLBACK |
| `supabase/tests/check_rls_enabled.sql` | PASS locally; all seven public tables have RLS |
| Legacy migration exercise, separate disposable database | PASS: original row/URL preserved, tenant backfilled, missing private file quarantined, new upload does not require `file_url`, migration rerun succeeds |
| Orphan legacy exercise, separate disposable database | PASS: descriptive error, complete rollback, original row retained |
| `git diff --check` | PASS |
| Client bundle scan for `SUPABASE_SERVICE_ROLE_KEY` / `getSupabaseAdminClient` | 0 files matched in `.next/static`; admin client imported only by the server download route |

The SQL was executed with a temporary Node `pg` client against an embedded PostgreSQL process over a Unix socket
(`psql` was not installed). Disposable packages, scripts, database files and HTML stayed under ignored
`node_modules/.phase5-tools`; no database binaries, credentials or artifacts are committed. The reproducible owner
commands use `psql` as shown below and in `supabase/tests/README.md`.

### Public-page HTTP smoke checks (local fixture, not live Supabase)

A temporary gateway connected the production Next server to the **actual local PostgreSQL public RPC**. Its
Storage signing endpoint was **mocked**; no real file bytes, Supabase Auth sessions, or Storage HTTP security
were tested. The gateway is not application code and is not shipped.

* `curl /p/cccccccc-cccc-4ccc-8ccc-ccccccccccc1` → **200**.
* `grep -o PRIVATE_DOC_NAME_MARKER public-pass.html | wc -l` → **0**. The public document link was present.
* Matching token + private document id (`…9992`) → plain **404**, `Cache-Control: no-store`.
* Other equipment's token + real public document id (`…9991`) → plain **404**, `no-store`.
* Matching token + public document id → **307**, `no-store`, mocked signing URL only.
* Malformed document id → plain **404**, `no-store`.
* Changing the public row to Private → next page **200**, former document link occurrences **0**, download route **404**.
* Replaced equipment + historical public document → **307**, matching the existing public passport behaviour (mock signing).
* Signed-out `/dashboard/documents` → **307** to sign-in.

These observations validate rendering and route pairing, **not live Storage protection**. Required four-vector
live evidence is currently:

| Attack vector | Live result |
|---|---|
| Direct anonymous object/public URL for a private document | **UNVERIFIED — not run, no Supabase configuration** |
| Public download route with a private document id | **UNVERIFIED live** (local route check: 404) |
| Other equipment token with a real public document id | **UNVERIFIED live** (local route check: 404) |
| Anonymous bucket listing / authenticated-object URL | **UNVERIFIED — not run, no Supabase configuration** |

## Owner: apply and verify against staging

1. Configure `.env.local` / server environment using `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is **server-only**,
   never `NEXT_PUBLIC_`. Do not share keys in chat. Configure `NEXT_PUBLIC_SITE_URL` correctly before printing labels.
2. Apply all prerequisite migrations and then Phase 5, using an owner role that can manage Storage policies:

   ```bash
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20261105000001_phase5_documents.sql
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/check_rls_enabled.sql
   ```

   Expect `COMMIT` from the migration; all test notices must PASS and the isolation suite must end in ROLLBACK.
   The migration SQL creates the **private** `documents` bucket, exact MIME allowlist and **15,728,640-byte** limit.
   If CLI Storage permissions fail, use the precise Dashboard instructions in `README.md` → Phase 5 bucket setup.
   Audit existing broad `anon`/`public` Storage policies: no such policy may grant access to this bucket.
3. Create **two real staging companies**. Upload a Public PDF and a Private file named **PRIVATE_DOC_NAME_MARKER**
   to A; upload another document under B. Use actual uploads, not SQL-only Storage metadata fixtures, for HTTP tests.
4. Assign the following shell variables from these real staging records (ids/paths are not credentials):
   `BASE_URL`, `TOKEN`, `OTHER_TOKEN`, `PUBLIC_ID`, `PRIVATE_ID`, `PRIVATE_PATH`, `COMPANY_ID`.
   `OTHER_TOKEN` must identify the other company's equipment. `PRIVATE_PATH` is the actual bucket key.
5. Run these commands without signed-in cookies. Expected statuses are comments, **not session results**:

   ```bash
   curl -sS -o /dev/null -w '%{http_code}\n' "$BASE_URL/p/$TOKEN"                     # 200
   curl -sS "$BASE_URL/p/$TOKEN" | grep -c PRIVATE_DOC_NAME_MARKER                  # 0 (grep exit 1 means no match)
   curl -sS -o /dev/null -w '%{http_code}\n' "$BASE_URL/p/$TOKEN/documents/$PRIVATE_ID" # 404
   curl -sS -o /dev/null -w '%{http_code}\n' "$BASE_URL/p/$OTHER_TOKEN/documents/$PUBLIC_ID" # 404
   curl -sS -D - -o /dev/null "$BASE_URL/p/$TOKEN/documents/$PUBLIC_ID"              # 307, no-store
   curl -sS -o /dev/null -w '%{http_code}\n' \
     "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/public/documents/$PRIVATE_PATH"    # denied, normally 400/403
   curl -sS -o /dev/null -w '%{http_code}\n' \
     -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/authenticated/documents/$PRIVATE_PATH" # denied
   curl -sS -D - -X POST \
     -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     -H "Authorization: Bearer $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
     -H 'Content-Type: application/json' \
     --data "{\"prefix\":\"$COMPANY_ID/\",\"limit\":100}" \
     "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/list/documents"                 # denied OR [] only, never object metadata
   ```

   Supabase may use a different 4xx for not-found/denied objects. Verify **no bytes** are returned; listing may return
   `200 []` under RLS (still no access). Retain the actual outputs for all four attack vectors before approval.
6. Follow the public 307 link and verify the real file opens/downloads. Save a signed URL, make the document Private,
   reload the passport (name/link gone) and verify the public route is 404 immediately. Existing signed links may
   work until the **300-second TTL**, then must fail on a fresh request. Already downloaded files cannot be recalled.
7. Sign in as A and attempt to read/sign/download B's actual document and Storage path; both must be denied.

## Manual acceptance matrix still required

- Upload a PDF, JPEG, PNG and WEBP from desktop and a phone; verify metadata and actual download bytes.
- Upload a 20 MB file and a text/HTML file renamed `.pdf`: clear rejection, no saved row/object.
- Verify all three list filters, pagination, empty/loading/error states, edit/rename/type changes, and confirmations
  in **both** visibility directions. Private label must read “Private — never shown on UnitPass”.
- Delete a document and verify both metadata and bytes are gone; exercise retry behaviour if one step fails.
- At **375 px**, verify the cards, upload dialog, file picker and actions are readable/usable with no horizontal overflow.
- Verify no changes to the printed QR token and that public documents for Replaced equipment remain readable.
- Confirm hosting payload limits: Next is configured for a 16 MB multipart body, **but Vercel Functions limit bodies
  to 4.5 MB**. Full 15 MB Server Action uploads need a compatible host, or an approved direct-storage upload/finalize
  enhancement. The Next setting cannot override that platform limit.

## Deferred

Antivirus scanning, OCR/search, versioning, expiry reminders, service-record attachments, bulk upload and managed
share-link expiry; optional company-logo/equipment-photo upload is not part of the Phase 5 document spec. No
reminders, billing or Phase 8 work was added. Legacy external file access must be reviewed by its original host owner.
