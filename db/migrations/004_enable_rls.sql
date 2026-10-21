-- 004: Lock down the public schema (fixes Supabase advisor rls_disabled_in_public)
--      and add explicit grants ahead of Supabase's Oct 30, 2026 change
--      (new public tables are no longer auto-granted to API roles).
--
-- Why this is safe for the live app: the Asshield MCP server (mcp.asshield.com)
-- only talks to Supabase with SUPABASE_SERVICE_ROLE_KEY (src/db.ts). The
-- service_role bypasses RLS, so enabling RLS with NO anon/authenticated policies
-- blocks public API access while the app keeps full read/write.
--
-- Run once in: https://supabase.com/dashboard/project/fezrvbugwvxiyebefcth/sql/new
-- Idempotent: safe to re-run.

begin;

-- 1. Enable RLS on every table in public (covers customers, quotes, drivers,
--    vehicles, current_policies, consents, documents, activities, and any others).
do $$
declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- 2. Remove all API access for anon / authenticated.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- 3. Explicit grants for the app's role (service_role).
grant usage on schema public to service_role;
grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- 4. Future objects created by postgres in public: service_role only.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
alter default privileges for role postgres in schema public
  grant all on functions to service_role;

commit;

-- Verification: every row should show rls_enabled = true and anon_select = false.
select c.relname as table_name,
       c.relrowsecurity as rls_enabled,
       has_table_privilege('anon', c.oid, 'select') as anon_select,
       has_table_privilege('service_role', c.oid, 'select,insert,update,delete') as service_role_rw
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind in ('r','p')
order by 1;
