-- UnitPass Phase 5: documents and a SINGLE PRIVATE storage bucket.
-- Apply after Phases 1–4. Idempotent; preserves legacy rows and file_url values.
-- Legacy files are NOT fetched/moved from arbitrary URLs. Missing storage metadata
-- remains quarantined until the owner re-uploads; only new valid private paths can
-- be published. A NOT VALID constraint enforces metadata for all new/updated rows.
begin;

do $$ begin
  create type public.document_type as enum ('Warranty', 'User Manual', 'Installation Invoice', 'Service Report', 'Other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.document_visibility as enum ('Public', 'Private');
exception when duplicate_object then null; end $$;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  type public.document_type not null,
  visibility public.document_visibility not null default 'Private',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.documents add column if not exists company_id uuid;
alter table public.documents add column if not exists storage_path text;
alter table public.documents add column if not exists file_name text;
alter table public.documents add column if not exists mime_type text;
alter table public.documents add column if not exists file_size bigint;
alter table public.documents add column if not exists uploaded_by uuid;
alter table public.documents add column if not exists file_url text;
alter table public.documents add column if not exists updated_at timestamptz not null default now();
alter table public.documents alter column file_url drop not null;
alter table public.documents alter column visibility set default 'Private';
comment on column public.documents.file_url is 'DEPRECATED: preserved legacy data only. Never read or write for new documents; no public URLs are stored by UnitPass.';
comment on column public.documents.storage_path is 'Private documents bucket key. Legacy NULLs are quarantined: re-upload before editing/publishing/downloading.';

update public.documents d set company_id = e.company_id
from public.equipment e where e.id = d.equipment_id and d.company_id is distinct from e.company_id;
do $$ begin
  if exists (select 1 from public.documents d left join public.equipment e on e.id = d.equipment_id
             where e.id is null or d.company_id is null) then
    raise exception 'Phase 5 stopped: orphan documents cannot be assigned a company. Repair the equipment references with owner approval, then rerun. No data has been deleted.';
  end if;
end $$;
alter table public.documents alter column company_id set not null;

-- Foreign keys missing from the legacy table (existing constraints are retained).
do $$
declare col text; target text;
begin
  for col, target in select * from (values ('company_id', 'public.companies'), ('equipment_id', 'public.equipment'), ('uploaded_by', 'auth.users')) v(c,t)
  loop
    if not exists (select 1 from pg_constraint where conrelid = 'public.documents'::regclass and contype = 'f'
      and conkey = array[(select attnum from pg_attribute where attrelid = 'public.documents'::regclass and attname = col)]::smallint[]) then
      execute format('alter table public.documents add constraint %I foreign key (%I) references %s(id) on delete %s',
        'documents_' || col || '_fkey', col, target, case when col = 'uploaded_by' then 'set null' else 'cascade' end);
    end if;
  end loop;
end $$;

create or replace function public.set_documents_company()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_company uuid;
begin
  select company_id into v_company from public.equipment where id = new.equipment_id;
  if v_company is null then raise exception 'unknown equipment_id' using errcode = '23503'; end if;
  new.company_id := v_company;
  if tg_op = 'UPDATE' then
    if new.equipment_id is distinct from old.equipment_id then
      raise exception 'A document cannot be moved to different equipment' using errcode = '23514';
    end if;
    if old.storage_path is not null and (new.storage_path is distinct from old.storage_path
      or new.file_name is distinct from old.file_name or new.mime_type is distinct from old.mime_type
      or new.file_size is distinct from old.file_size) then
      raise exception 'Uploaded file metadata is immutable; upload a new document instead' using errcode = '23514';
    end if;
    new.uploaded_by := old.uploaded_by;
  elsif (select auth.uid()) is not null then
    new.uploaded_by := (select auth.uid());
  end if;
  return new;
end $$;
revoke all on function public.set_documents_company() from public;
drop trigger if exists documents_set_company on public.documents;
create trigger documents_set_company before insert or update on public.documents
  for each row execute function public.set_documents_company();
drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- NOT VALID is intentional: do not invent paths/metadata for old external URLs.
-- It still checks EVERY new row and every update, including direct REST writes.
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.documents'::regclass and conname = 'documents_private_storage_metadata') then
    alter table public.documents add constraint documents_private_storage_metadata check (
      storage_path is not null and file_name is not null and mime_type is not null and file_size is not null
      and length(file_name) between 1 and 120 and file_name ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
      and file_size between 1 and 15728640
      and mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
      and storage_path ~ ('^' || company_id::text || '/' || equipment_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9][A-Za-z0-9._-]{0,119}$')
    ) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.documents'::regclass and conname = 'documents_name_length') then
    alter table public.documents add constraint documents_name_length check (length(btrim(name)) between 1 and 200) not valid;
  end if;
end $$;

create index if not exists documents_company_equipment_idx on public.documents(company_id, equipment_id);
create index if not exists documents_company_visibility_idx on public.documents(company_id, visibility);
create index if not exists documents_equipment_created_idx on public.documents(equipment_id, created_at desc);
create index if not exists documents_uploaded_by_idx on public.documents(uploaded_by);
alter table public.documents enable row level security;
-- Replace any legacy document policies, not other tables' policies.
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'documents' loop
    execute format('drop policy %I on public.documents', p.policyname);
  end loop;
end $$;
create policy documents_select_members on public.documents for select to authenticated using (public.is_company_member(company_id));
create policy documents_insert_members on public.documents for insert to authenticated with check (public.is_company_member(company_id));
create policy documents_update_members on public.documents for update to authenticated using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));
create policy documents_delete_members on public.documents for delete to authenticated using (public.is_company_member(company_id));
revoke all on public.documents from public, anon;
grant select, insert, update, delete on public.documents to authenticated;
grant all on public.documents to service_role;

-- Membership, never profiles.company_id. All three current company roles can
-- manage documents (matching table RLS); writes explicitly check the role.
-- No UUID casts of untrusted paths: malformed paths simply return false.
create or replace function public.can_access_document_storage(object_name text, write_access boolean default false)
returns boolean language sql stable security definer set search_path = '' as $$
  select object_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-[A-Za-z0-9][A-Za-z0-9._-]{0,119}$'
    and exists (
      select 1 from public.company_members m join public.equipment e on e.company_id = m.company_id
      where m.user_id = (select auth.uid())
        and m.company_id::text = split_part(object_name, '/', 1)
        and e.id::text = split_part(object_name, '/', 2)
        and (not write_access or m.role in ('owner', 'admin', 'technician'))
    );
$$;
revoke all on function public.can_access_document_storage(text, boolean) from public, anon;
grant execute on function public.can_access_document_storage(text, boolean) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 15728640, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Supabase owns storage.objects; explicitly retain RLS even on a partial install.
-- No anon/public grant policies.
alter table storage.objects enable row level security;
drop policy if exists documents_select_members on storage.objects;
drop policy if exists documents_insert_members on storage.objects;
drop policy if exists documents_update_members on storage.objects;
drop policy if exists documents_delete_members on storage.objects;
create policy documents_select_members on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.can_access_document_storage(name, false));
create policy documents_insert_members on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.can_access_document_storage(name, true));
create policy documents_update_members on storage.objects for update to authenticated
  using (bucket_id = 'documents' and public.can_access_document_storage(name, true))
  with check (bucket_id = 'documents' and public.can_access_document_storage(name, true));
create policy documents_delete_members on storage.objects for delete to authenticated
  using (bucket_id = 'documents' and public.can_access_document_storage(name, true));
-- Fence authenticated access even if an older generic permissive policy exists.
-- Other buckets are unaffected. Audit older anon/public policies with the tests.
drop policy if exists documents_member_fence on storage.objects;
create policy documents_member_fence on storage.objects as restrictive for all to authenticated
  using (bucket_id <> 'documents' or public.can_access_document_storage(name, true))
  with check (bucket_id <> 'documents' or public.can_access_document_storage(name, true));

-- Keep the Phase 4 whitelist/history unchanged; add ONLY id/name/type of public
-- documents with usable private storage metadata. Replaced passports continue
-- serving their historical public documents, just like the existing public page.
create or replace function public.get_public_unitpass(p_token uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'company', jsonb_build_object('name', c.name, 'phone', c.phone, 'email', c.email,
      'website', c.website, 'service_booking_url', c.service_booking_url, 'logo_url', c.logo_url),
    'equipment', jsonb_build_object('name', e.equipment_name, 'type', e.equipment_type,
      'manufacturer', e.manufacturer, 'model_number', e.model_number, 'serial_number', e.serial_number,
      'installation_date', e.installation_date, 'warranty_expiration_date', e.warranty_expiration_date,
      'warranty_notes', e.warranty_notes, 'public_notes', e.public_notes, 'status', e.status, 'photo_path', e.equipment_photo_path),
    'service_history', coalesce((
      select jsonb_agg(entry order by entry_date desc, entry_created desc) from (
        select jsonb_build_object('service_date', sr.service_date, 'service_type', sr.service_type,
          'technician_name', sr.technician_name, 'public_notes', sr.public_notes) as entry,
          sr.service_date as entry_date, sr.created_at as entry_created
        from public.service_records sr where sr.equipment_id = e.id
        order by sr.service_date desc, sr.created_at desc limit 20
      ) history
    ), '[]'::jsonb),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'type', d.type) order by d.created_at desc, d.id)
      from public.documents d where d.equipment_id = e.id and d.company_id = e.company_id
        and d.visibility = 'Public' and d.storage_path is not null and d.file_name is not null
        and d.mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') and d.file_size between 1 and 15728640
    ), '[]'::jsonb)
  ) from public.equipment e join public.companies c on c.id = e.company_id where e.public_token = p_token;
$$;
revoke all on function public.get_public_unitpass(uuid) from public;
grant execute on function public.get_public_unitpass(uuid) to anon, authenticated, service_role;
commit;
