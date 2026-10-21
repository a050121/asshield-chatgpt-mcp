# Migration 004 status

- Written 2026-10-21 to fix Supabase CRITICAL advisor `rls_disabled_in_public` and the Oct 30 explicit-grants change.
- No SQL connection is configured for this project (no DATABASE_URL / DB password / Supabase access token), so it must be run in the Supabase SQL editor:
  https://supabase.com/dashboard/project/fezrvbugwvxiyebefcth/sql/new
- App impact: none. The MCP server uses only the service_role key, which bypasses RLS and keeps explicit grants.
