-- Narrow legacy public.profiles SELECT policy to self-only (id = auth.uid()) when the table exists.
-- Server-side staff lookups use the service-role connection and do not rely on broad browser SELECT policies.
do $migration$
declare
  pol record;
begin
  if to_regclass('public.profiles') is not null then
    execute 'alter table public.profiles enable row level security';
    for pol in
      select policyname from pg_policies
      where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
    loop
      execute format('drop policy if exists %I on public.profiles', pol.policyname);
    end loop;
    execute 'create policy profiles_self_select_only on public.profiles for select to authenticated using (id = auth.uid())';
  end if;
end;
$migration$;
