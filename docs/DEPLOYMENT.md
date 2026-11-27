# Deployment foundation (Phase 0)

This guide documents the target split deployment. The existing root Vite/Express deployment remains active until the replacement passes the release gates and is explicitly promoted.

## Supabase

1. Create a Supabase project and configure Auth providers and allowed redirect URLs.
2. Copy the project URL and publishable key into `apps/web` environment variables. Never place the service-role key in the web app.
3. Create a dedicated non-owner, non-superuser PostgreSQL login for API runtime and grant it only required table privileges. Never run the API as `postgres`, a table owner, or a role with `BYPASSRLS`; those roles defeat tenant RLS. The API sets transaction-local user and institution context after validating the Supabase JWT. `DATABASE_URL` uses that restricted role; `DIRECT_URL` uses a migration owner.
4. Before migrations, create the restricted `intellischedule_app` role described below and set its password securely. Apply schema with `cd apps/api && alembic upgrade head`. The initial Alembic revision creates isolated `intellischedule_v2` institution and user identity tables with tenant membership uniqueness and forced RLS policies. It leaves the current `public` schema unchanged. API policies read transaction-local settings; the app role must not own the tables or bypass RLS.
5. Create the initial Supabase Auth user through the Supabase dashboard/Auth API, then run `python -m scripts.bootstrap_admin` with that user's UUID and institution details using the migration-owner connection. The bootstrap script maps that existing Auth identity to `SUPER_ADMIN` and refuses to overwrite a conflicting mapping. Do not put role assignments in user-editable metadata; role authority comes from the app database.

Example runtime-role setup (run as the migration owner before running Alembic; replace the database name and set a unique role password using a secure `psql` `\\password intellischedule_app` prompt). The migration grants table access in the isolated schema.

```sql
CREATE ROLE intellischedule_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT CONNECT ON DATABASE postgres TO intellischedule_app;
```

Run first-time bootstrap with the Supabase `postgres`/migration-owner connection that can bypass forced RLS; never give that credential to the API. The new schema is not exposed through Supabase Data API; future domain migrations must add forced RLS and explicit least-privilege grants for every tenant-owned table. Keep the worker's cross-tenant outbox access on a separate, narrowly scoped credential; the API role must remain tenant constrained.

## Render

Create services from the repository Blueprint `render.yaml`: API web service and worker. Each currently uses Render's paid `0.5c-512mb` plan; confirm that spend before provisioning. Set `DATABASE_URL` to the restricted runtime role, `DIRECT_URL` to the migration connection, `SUPABASE_URL`, `SUPABASE_JWKS_URL`, and `CORS_ALLOWED_ORIGINS` in Render's secret/config interface. Confirm the project region and select a matching supported Render region before provisioning. The Blueprint health check uses `/health`; `/ready` checks the database.

The API currently includes health/readiness and verified-JWKS identity lookup. Phase 0 does not yet implement domain modules, outbox dispatch, or durable solve jobs. Do not route production traffic to it as a replacement for the current app yet.

## Vercel

Import the repository with root directory `apps/web`. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_API_BASE_URL` for Preview and Production. Do not set server secrets in `NEXT_PUBLIC_*` variables. Deploy the web shell only after Supabase Auth redirects and API CORS have been configured.

## Smoke checks

- `GET /health` returns `200 {"status":"ok"}`.
- `GET /ready` returns `503` without a production database, and `200` only after `SELECT 1` succeeds.
- An unauthenticated `/dashboard` request redirects to `/login`.
- A valid Supabase session can render `/dashboard`; `/v1/me` additionally requires a matching active app user and institution membership.

## Phase 0 release gates still requiring hosted infrastructure

- Run PostgreSQL/RLS integration tests against an isolated Supabase or PostgreSQL project using the same restricted database role as Render.
- Confirm the Supabase project's signing algorithm/JWKS, Auth redirect settings, Data API exposure and policies.
- Configure Vercel, Render, Supabase secrets and matching deployment regions; none are changed by this repository work.
- Replace the existing root Vercel project configuration only after migration and rollback have been reviewed.

## Phase 1A — course catalog

The target FastAPI API now includes CRUD-lite course catalog endpoints and Alembic revision `0002_academic_courses`. The revision adds only `intellischedule_v2.courses`, enables and forces tenant RLS, and grants the restricted runtime role only the table operations required by these endpoints. It does not alter the legacy `public` schema. The migration has only been rendered as offline SQL locally; it has not been applied to any hosted database. PostgreSQL RLS integration tests and service deployment remain release gates.
