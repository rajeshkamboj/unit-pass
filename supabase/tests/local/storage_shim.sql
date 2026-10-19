-- LOCAL/DISPOSABLE PostgreSQL ONLY. Never apply to Supabase.
-- Models Storage's table/policy surface, NOT its HTTP API or signed URLs.
-- A passing local RLS test does not verify deployed Supabase Storage behaviour.
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  metadata jsonb,
  unique(bucket_id, name)
);
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to anon, authenticated, service_role;
grant all on storage.buckets to service_role;
