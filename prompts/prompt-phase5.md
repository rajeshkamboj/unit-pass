# PHASE 5 — Documents and Secure Storage

**Branch:** `phase/05-documents` (from the latest `main`; **verify Phases 1–4 are merged**)
**Prerequisites:** Phases 1–4 merged into `main`. /prompts/README.md read in full.
**Depends on:** Phase 3 (equipment, public token, public page + public RPC), Phase 4 (equipment detail page pattern).
**Blocks:** Phase 8 (document-related QA only).

---

## 1. Objective

Let a company attach the documents that make a UnitPass valuable — warranties, manuals, installation invoices,
service reports — with an explicit **Public / Private** choice, and deliver them safely:

* **Public documents** appear on the homeowner's UnitPass.
* **Private documents** are visible only inside the authenticated dashboard and are **not retrievable by guessing or
  changing a URL**.

---

## 2. Preconditions and branch setup

```bash
git status && git fetch origin --prune
git checkout main && git pull --ff-only origin main
git log --oneline -20                       # Phases 1–4 must be present
ls src/app/dashboard/equipment src/app/p    # Phase 3/4 surfaces must exist
git checkout -b phase/05-documents
git push -u origin phase/05-documents

pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm build    # green before you start
```

If Phase 4 is not in `main`: stop and report.

---

## 3. Scope

### 3.1 Data model

Fields (`documents`):

* `equipment_id` (required, same company as the caller)
* `company_id` (denormalised, trigger-derived — never accepted from a form)
* `name` (required, human label shown to the company and, for public docs, to the homeowner)
* `type` (required, enum: `Warranty`, `User Manual`, `Installation Invoice`, `Service Report`, `Other`)
* `visibility` (required, enum: `Public`, `Private`, default `Private`)
* `storage_path` (required — the object path inside the private bucket)
* `file_name` (original file name, sanitized copy for display/download)
* `mime_type`, `file_size` (recorded at upload for display and validation)
* `uploaded_by` (uuid → `auth.users`, nullable)
* timestamps (`created_at`, `updated_at`)

Do not use the legacy `file_url` column for new records (mark it deprecated in the migration comment; do **not** drop
it). Never store public URLs in the database.

### 3.2 Storage design (single private bucket)

* Bucket: **`documents`**, **private** (`public = false`). Never create a public bucket and never call
  `getPublicUrl()` for documents.
* Path convention: `{company_id}/{equipment_id}/{uuid}-{sanitized-file-name}` (the UUID prevents collisions and makes
  objects unguessable even if a path structure is known).
* Bucket limits (set them at the bucket level **and** validate in the server action):
  * allowed MIME types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`
  * max size: **15 MB**
* Storage RLS policies (in the migration):
  * `select` / `insert` / `update` / `delete` for `authenticated` only, restricted to the member's company prefix:
    `(storage.foldername(name))[1] = (select company_id::text from public.profiles where id = auth.uid())` is unsafe
    if `profiles.company_id` is stale — so instead resolve the company from `public.company_members` (use an
    `exists` check or a small `security definer` helper such as `public.is_member_of_company_text(text)`), and always
    combine it with a role check for write operations.
  * **No `anon` policies at all.** Anonymous users must have zero access to `storage.objects` in this bucket.
* If the SQL for `storage.buckets` / `storage.objects` policies cannot be executed with the available credentials,
  say so explicitly and document the exact dashboard steps (bucket name, private flag, file size limit, allowed MIME
  types, policies) — the phase cannot claim `SECURITY CHECK: PASS` until they exist.

### 3.3 Upload, list, download, delete (dashboard)

Routes:

| Route | Purpose |
|---|---|
| `/dashboard/documents` | List + filters (equipment, type, visibility) + upload entry point |
| `/dashboard/equipment/[id]` | Documents section for that unit (primary place to upload) |
| `/dashboard/documents/[id]` (optional) | Document detail/edit (rename, change type/visibility) |

Requirements:

* **Upload** via a Server Action that: checks the session and membership, sanitizes the file name
  (strip path separators/control characters, trim to ~120 chars, keep the extension), verifies the declared MIME type
  and size, **checks the file signature** (PDF `%PDF`, PNG `\x89PNG`, JPEG `\xFF\xD8\xFF`, WEBP `RIFF....WEBP`) and
  rejects mismatches, uploads with the server client (member RLS applies) or the server-only admin client into the
  company's own prefix, then inserts the `documents` row. Delete the uploaded object if the row insert fails.
* Do not accept arbitrary file types "just in case". Do not accept HTML/SVG (XSS vector).
* **List**: filter by equipment, type and visibility; show name, type, visibility chip (**Public** clearly marked as
  visible to homeowners), size, uploaded date, and actions (download, edit, delete).
* **Download**: short-lived signed URL (5 minutes) created server-side (Server Action) or via the browser client
  (`supabase.storage.from('documents').createSignedUrl(path, 300)`), which the storage RLS `select` policy permits for
  members of the company. Either way the object stays private; never render a permanent URL.
* **Edit**: rename, change `type`, and change `visibility`. Warn before making a document public ("This will be visible
  to anyone who scans the equipment's QR code") and before making a public document private.
* **Delete**: explicit confirmation; delete the storage object first, then the row (or row first with a compensating
  cleanup — pick one and handle the partial-failure case with a clear error).
* Private documents must be visibly labelled **Private — never shown on UnitPass**.
* Empty/loading/error states; mobile-friendly (cards below `md`; upload works from a phone browser).

### 3.4 Public documents on UnitPass

* Extend `public.get_public_unitpass(uuid)` to include a `documents` array containing **only** rows with
  `visibility = 'Public'`: `{ id, name, type }` (the `id` here is the document id — acceptable because the route
  below validates the token pairing; never include `storage_path`).
* The public page renders a "Documents" section with download links to
  `/p/{token}/documents/{documentId}` (hide the section when empty).
* Implement that download as a **route handler** `src/app/p/[token]/documents/[documentId]/route.ts`:
  1. look up the document **and** verify (a) `visibility = 'Public'`, (b) the document's equipment has the exact
     `public_token` from the URL, (c) the equipment is not `Replaced` beyond what the public page already allows;
  2. on any failure → return a plain **404** (never 403 with details, never a redirect to the dashboard);
  3. on success → create a **short-lived signed URL (≤ 5 minutes)** with the server-only admin client and
     `307` redirect to it, with `Cache-Control: no-store`.
* The signed URL is the only way to fetch the bytes: guessing `storage/v1/object/public/documents/...` must fail
  (bucket is private), and guessing `/p/<other-token>/documents/<real-id>` must 404.

### 3.5 Navigation

Add **Documents** to the sidebar (README §11 order: Dashboard, Customers, Equipment, Services, Documents, Settings).

---

## 4. Explicit exclusions

Document versioning/revisions, OCR/text extraction/search inside files, e-signatures, emailing documents, bulk upload,
folder hierarchies, stickers/labels, sharing links with expiry management UI, public listing pages, antivirus
scanning services (note it as a future consideration), and everything in Phases 6–8. Do not attach documents to
service records in this phase (that is a later enhancement; only equipment-level documents are in scope).

---

## 5. Database and migration requirements

New idempotent migration, e.g. `supabase/migrations/20261105000001_phase5_documents.sql`:

1. Ensure the `document_type` and `document_visibility` enums exist (`do $$ ... exception when duplicate_object ...`).
2. `create table if not exists public.documents` with the §3.1 columns,
   `equipment_id uuid not null references public.equipment(id) on delete cascade`,
   `company_id uuid not null references public.companies(id) on delete cascade`,
   `uploaded_by uuid references auth.users(id) on delete set null`, timestamps + `set_updated_at` trigger.
   * Existing legacy table: `add column if not exists` for `company_id`, `storage_path`, `file_name`, `mime_type`,
     `file_size`, `uploaded_by`, `updated_at`; backfill `company_id` from `equipment` where possible; only enforce
     `not null` if no orphans exist (otherwise stop and report).
   * Keep the legacy `file_url` column (deprecated, unused).
3. Trigger `set_documents_company()` (same pattern as Phase 4's `set_service_record_company()`) resolving
   `company_id` from `equipment`.
4. Indexes: `documents(company_id, equipment_id)`, `documents(company_id, visibility)`,
   `documents(equipment_id, created_at desc)`.
5. RLS on `documents`: `select/insert/update/delete` using `public.is_company_member(company_id)`
   (with check on insert/update). `revoke all on public.documents from anon;` grant to `authenticated`.
6. Bucket + storage policies (idempotent):
   `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('documents','documents', false, 15728640, array['application/pdf','image/jpeg','image/png','image/webp']) on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;`
   plus `drop policy if exists` + `create policy` for the four operations scoped to the company prefix and
   `to authenticated`.
7. Rebuild `public.get_public_unitpass(uuid)` to add the public `documents` array (same signature — no `drop function`).

Append a Phase 5 section to `supabase/tests/rls_tenant_isolation.sql`:
* A cannot select/update/delete B's document rows;
* inserting a document row with B's `equipment_id` fails;
* spoofed `company_id` is overwritten by the trigger;
* `get_public_unitpass(A token)` lists only A's **public** documents and never a seeded **private** document name;
* `anon` has no privileges on `public.documents` (permission denied / zero rows).

---

## 6. Security requirements (this phase is a security milestone)

1. Bucket is **private**; no public bucket, no `getPublicUrl` for documents, no permanent signed URLs stored anywhere.
2. Private documents are unreachable anonymously: guessing a storage path, listing the bucket, or constructing a
   `.../object/public/...` URL must all fail. Prove it with `curl` (expect 400/403) and record the output.
3. The public download route validates document ↔ equipment ↔ token and returns a plain 404 on any mismatch; the
   response is `no-store` and the signed URL expires in ≤ 5 minutes.
4. Cross-tenant download attempts fail (storage RLS + row-level check).
5. Upload validation: extension + declared MIME + signature check + size limit; reject mismatches with a clear error.
6. File names are sanitized before being used in storage paths, and the original name is stored as data, never
   concatenated into a URL.
7. `private_notes`, `installer_notes`, `storage_path`s and internal ids never appear in public HTML/JSON.
8. RLS enabled on `documents`; `anon` has zero table privileges; no service-role key reaches the client bundle.
9. The service-role key, if used for signed URLs, lives in a single server-only module
   (`src/lib/supabase/admin.ts` with `import 'server-only'`) — verify no client component imports it
   (`grep -rn "admin" src/app --include=*.tsx` sanity check + build output inspection if needed).

---

## 7. Acceptance criteria

* [ ] `pnpm typecheck && pnpm lint && pnpm build` pass.
* [ ] Upload works for a PDF, a JPEG/PNG and a WEBP; oversized files and disallowed types are rejected with clear
      messages (server-side, not just `accept="..."` in the input).
* [ ] A file whose extension/MIME lies about its content is rejected.
* [ ] Documents list filters by equipment, type and visibility; visibility is obvious in the UI.
* [ ] Public documents appear on `/p/{token}` and download successfully through
      `/p/{token}/documents/{id}`.
* [ ] Private documents do **not** appear on the public page and cannot be fetched by
      (a) direct storage URL, (b) `/p/{token}/documents/{privateId}`, (c) another company's `/p/{token}` with the real
      document id, or (d) bucket listing.
* [ ] Changing a document to Private removes it from the public page immediately (no cached link keeps working beyond
      the signed URL TTL — document the TTL behaviour).
* [ ] Company A cannot see or download Company B's documents (row + storage level).
* [ ] Storage bucket is private with size/MIME limits set (SQL or documented dashboard steps).
* [ ] Sidebar shows Dashboard, Customers, Equipment, Services, Documents, Settings only.
* [ ] Mobile: uploading from a phone browser works; list is card-based and readable at 375 px.
* [ ] No future-phase functionality implemented.

---

## 8. Tests and verification

```bash
pnpm typecheck && pnpm lint && pnpm build
pnpm dev

# private data must not leak publicly (replace ids/paths with real ones from your fixtures)
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/p/<real-token>"                      # 200
curl -s "http://localhost:3000/p/<real-token>" | grep -c "PRIVATE_DOC_NAME_MARKER"                    # 0
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/p/<real-token>/documents/<private-id>" # 404
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/p/<wrong-token>/documents/<public-id>"  # 404
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/p/<real-token>/documents/<public-id>"   # 307 → signed URL
curl -s -o /dev/null -w "%{http_code}\n" "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/public/documents/<path>" # 400/403

# database
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<phase5>.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_tenant_isolation.sql
```

Manual matrix (record pass/fail):

| # | Test | Expected |
|---|---|---|
| 1 | Upload a PDF as Public | appears in the dashboard list and on the public page |
| 2 | Upload a 20 MB file | rejected with a clear size error |
| 3 | Upload a `.txt` renamed to `.pdf` | rejected (signature check) |
| 4 | Open a public document from the public page on a phone | downloads/opens the file |
| 5 | Upload a Private document | not on the public page; downloadable from the dashboard |
| 6 | Paste a private document's storage path into a browser (unauthenticated) | denied |
| 7 | Toggle a public document to Private | disappears from the public page on reload |
| 8 | Company A opens Company B's document id | 404/denied |
| 9 | Delete a document | removed from list + public page; storage object gone |
| 10 | 375 px viewport | upload + list usable |

---

## 9. Environment variables and external services

`SUPABASE_SERVICE_ROLE_KEY` is required **server-side only** for the public download route's signed URLs (and any admin
storage operations). Add its name to `.env.example` (it may already be there from Phase 3) and document in `README.md`
that it must never be exposed with a `NEXT_PUBLIC_` prefix.

Owner configuration required: the `documents` bucket + storage policies must exist (migration or dashboard steps), and
the Supabase project must allow the file size limit (free-tier file limit is 50 MB — 15 MB is within it).

---

## 10. Files expected to change (guide)

Added: `supabase/migrations/<phase5>.sql`, `src/app/dashboard/documents/page.tsx` (+ list/filters),
`src/app/dashboard/documents/actions.ts`, `src/app/dashboard/documents/upload-form.tsx`,
`src/app/dashboard/documents/[id]/edit` (optional), `src/app/dashboard/equipment/[id]/documents-section.tsx`,
`src/app/p/[token]/documents/[documentId]/route.ts`, `src/lib/storage/documents.ts`,
`src/lib/validation/document.ts`, `src/lib/supabase/admin.ts` (if not created in Phase 3).

Modified: `src/components/Sidebar.tsx` (Documents), `src/app/dashboard/equipment/[id]/page.tsx` (documents section),
`src/app/p/[token]/page.tsx` (documents section), `supabase/tests/rls_tenant_isolation.sql` (Phase 5 section),
`.env.example`, `README.md`, `prompts/README.md` (decisions log row only).

---

## 11. Deferred (record under FUTURE PHASE NOTES)

Antivirus scanning, OCR/search, versioning, document expiry reminders, attaching documents to specific service
records, bulk upload, share links with configurable expiry, and everything in Phases 6–8.

---

## 12. Stop conditions

* Phase 3/4 are not in `main`, or baseline gates fail before you start.
* The bucket/policies cannot be created with the available credentials and cannot be documented precisely — say so and
  report `SECURITY CHECK: UNVERIFIED` rather than claiming private documents are protected.
* Existing document rows cannot be migrated (missing `company_id` with orphans) — report instead of forcing.
* Any part of the public download path would require making the bucket public — stop; that violates the phase's core
  requirement.

---

## 13. Phase completion report

Finish with the standard report from `/prompts/README.md` §6. Required specifics: the bucket configuration (how it was
created), the four `curl` results proving private documents are unreachable, the isolation-test result, the
public-page grep evidence that a seeded private document name is absent, and an honest `SAFE TO MERGE` — `NO` if any
public/private separation test failed or could not be executed.
