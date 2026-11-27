-- The application accesses this role catalog only with the server-side
-- Supabase service role. Browser roles must not read or mutate it directly.
-- Some installations predate this repository's checked-in migrations and may
-- not have the legacy public.roles table, so this remains safe on a fresh DB.
do $migration$
begin
  if to_regclass('public.roles') is not null then
    execute 'alter table public.roles enable row level security';
    execute 'revoke all privileges on table public.roles from anon, authenticated, public';
  end if;
end;
$migration$;
