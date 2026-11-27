# Database

Supabase Postgres is reached by the Node server through `DATABASE_URL` with the `pg` driver. The browser does not issue SQL or read academic tables directly. When configured, the server also uses Supabase Auth and the browser-safe client for sign-in flows; application data and the `intellischedule_session` cookie remain server-authoritative.

## Connection

- `DATABASE_URL`: Supabase -> Project Settings -> Database -> Connection string. On Cloud Run or other serverless hosts use the **Transaction pooler** URI (port 6543).
- TLS is always used for non-local hosts. Set `DATABASE_SSL_CA` to the Supabase CA certificate (Database settings -> SSL) to verify the server certificate; without it the connection is encrypted but not verified, and a warning is logged at start. Any `sslmode` in the URL is ignored.
- `PG_POOL_MAX` (default 5) limits the pool size.
- Production shares one PostgreSQL pool between account/session persistence and academic state. The pool closes after the HTTP server drains on `SIGTERM`/`SIGINT`.
- Development and tests use embedded Postgres (PGlite): `DATABASE_URL=pglite:./.data/pglite` (the development default) or `pglite:memory`. PGlite is refused when `NODE_ENV=production`.

## Schema

The server applies sorted files under `supabase/migrations/` in transactions. `intellischedule.application_migrations` records each filename and SHA-256 checksum; a changed applied migration fails startup, so schema changes must be additive new migrations. A database row lock serializes concurrent startup attempts. Existing installations apply the current files once when this ledger is first created.

The current app runtime stores data in the private `intellischedule` schema. RLS is enabled and no browser-role grants or policies are provided there; the server's database connection performs the authorized access. The database also still contains an older 24-table schema in `public`; current academic reads/writes use `intellischedule.app_state`, not those legacy academic tables. Some server-side Supabase Auth compatibility flows still access `public.profiles`, `public.institutions`, and `public.roles` with the service-role client.

| Table | Contents |
| --- | --- |
| `users` | App accounts: email, name, role, department, password hash (null when Supabase Auth owns the credential), status, demo flag and profile JSON. |
| `sessions` | SHA-256 token hashes, user ID, role, expiry and revocation state. Raw session tokens are not stored. |
| `pending_registrations` | Approval requests and password hashes, keyed by normalized email. |
| `one_time_tokens` | Password-reset token hashes, purpose, expiry and single-use state. |
| `rate_limit_buckets` | Persisted counters used to retain rate-limit state across restarts; in-process checks remain authoritative for the single server instance. |
| `app_state` | One versioned JSON document under `legacy_academic_runtime`, containing academic data, timetable versions/sessions, notifications, recovery tasks, polls and audit events. |
| `application_migrations`, `application_migration_lock` | Private migration ledger/checksums and startup serialization row. |

The older `auth_sessions`, `oauth_states`, `timetable_versions`, and `audit_log` tables are retained by existing migrations but are not the active session/academic persistence path in `server.ts`.

Expired/revoked sessions, consumed/expired reset tokens, and expired rate-limit snapshots are cleaned every ten minutes. Google OAuth state is short-lived in process memory and removed when expired states are encountered during a new OAuth attempt.

### `app_state` document

`legacy_academic_runtime` is a snapshot of the current in-memory `supabaseStore`: academic year, departments, programs, courses, faculty, rooms, groups/subgroups, students, allocations, constraints, timetable versions and active sessions, notifications, audit events, recovery tasks/opportunities, polls and votes.

## How writes work

The server loads `legacy_academic_runtime` and persisted users at start and keeps the academic state in memory. A change to academic or timetable data:

1. updates the in-memory copy,
2. updates the versioned row with `... where key = $1 and version = $2` (bumping `version`),
3. then sends the response.

If a document's `version` no longer matches (another process wrote first), the transaction rolls back, the request fails with 409 and the server reloads everything from the database. This prevents silent overwrites, but it also means **only one instance can serve traffic**. Use e.g. Cloud Run `--max-instances 1`.

Accounts and app sessions are read and written through `server.ts` and `src/server/persistentStore.ts`. A database read error is fatal at startup; it must never be treated as an empty account/session store.

Rate-limit decisions are enforced by the single server process; counter snapshots are persisted so a restart does not immediately erase them. This is not a distributed rate limiter, so keep the single-instance constraint.

## Seeding

On first start with no `legacy_academic_runtime` document, the server loads the sample dataset (`SEED_DEMO_DATA`, default on) or an empty one and saves it. Demo accounts are defined in `server.ts`; they are reconciled with the database according to production seed configuration. See [DEMO_ACCOUNTS.md](DEMO_ACCOUNTS.md).

## Useful SQL (Supabase SQL editor)

```sql
-- Sign everyone out
delete from intellischedule.sessions;

-- Lock the demo accounts (their sessions stop working immediately)
update intellischedule.users set status = 'LOCKED' where is_demo;

-- Current academic-state revision
select key, version, updated_at from intellischedule.app_state
where key = 'legacy_academic_runtime';

-- Recent audit entries
select event
from intellischedule.app_state, jsonb_array_elements(data->'auditEvents') as event
where key = 'legacy_academic_runtime'
order by event->>'timestamp' desc limit 50;
```

Do not edit `app_state` or `timetable_versions` by hand while the app is running: the running server keeps its in-memory copy. Restart the app after any manual change or restore.

To start over with fresh sample data on a non-production database, stop the app, run `drop schema intellischedule cascade;` and start it again (locally: delete `./.data/pglite`).

Backups and restores: [runbooks/backups.md](runbooks/backups.md).
