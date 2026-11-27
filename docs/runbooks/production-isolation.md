# Separate presentation and real production

## Environment boundary

Keep the current Vercel + Render + Supabase deployment as the public presentation environment. Its five demo roles (including Admin and Coordinator) intentionally have normal role permissions and share that deployment's database. Use synthetic data only there.

For real institutional records, create a separate Render web service and a separate Supabase project/database. The production service can serve both the React app and API from this repository; that avoids the current Vercel project's hard-coded rewrite to the presentation API. Do not apply the partial `render.yaml` Next.js/FastAPI migration Blueprint as a replacement: it does not yet contain feature parity with the existing timetable app.

## Render web service

Create a new Node web service from `Uddeshya112/project` using the production branch/commit approved for release. Configure:

- Build command: `bun install && bun run build`
- Start command: `bun run start`
- Health check: `/api/health/ready`
- Exactly one running instance. The legacy timetable state is one versioned in-memory snapshot backed by Postgres; horizontal scaling is not safe yet.
- Use an always-on paid instance for a real service; the free tier can sleep and is not an availability commitment. Select the plan and region based on the institution's budget and the new database region.

Set environment variables through Render's secret/config interface. Never commit their values.

| Variable | Production setting |
| --- | --- |
| `NODE_ENV` | `production` |
| `APP_URL` | New Render service URL (or its production domain) |
| `TRUST_PROXY` | `1` when Render is the single trusted reverse proxy |
| `DATABASE_URL` | New Supabase project's transaction-pooler URI |
| `DATABASE_SSL_CA` | Supabase CA certificate; required to verify the database TLS peer |
| `SUPABASE_URL` | New Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | New project's server-only secret key; never put in Vercel or browser variables |
| `SUPABASE_PUBLISHABLE_KEY` | New project's publishable key if Supabase Auth client calls are used |
| `ALLOWED_EMAIL_DOMAINS` | Institutional domains only, e.g. `thapar.edu` |
| `PUBLIC_DEMO_ENABLED` | `false` |
| `ALLOW_DEMO_IN_PRODUCTION` | `false` |
| `SEED_DEMO_DATA` | `false` |
| `SEED_SAMPLE_USERS` | `false` |
| `BOOTSTRAP_ADMIN_EMAIL` | Verified initial institutional administrator address |
| `BOOTSTRAP_ADMIN_PASSWORD` | One-time strong password, added as a secret |
| `BOOTSTRAP_ADMIN_NAME` | Initial administrator display name |

On the first start against the empty production database, the service creates no sample academic records and writes the initial College Admin to the private application users table. It refuses to start if no active administrator exists and bootstrap credentials are missing. After the first successful start, remove `BOOTSTRAP_ADMIN_PASSWORD`; the persisted admin remains and startup is idempotent.

## First production login and data setup

1. Confirm `/api/health/live` and `/api/health/ready` return HTTP 200. Readiness now performs `SELECT 1` against the application database.
2. Sign in with the bootstrap admin and verify access to Admin and Coordinator workspaces.
3. Import the institution's approved academic dataset and validate it before publishing. The empty production setup has no demo students, faculty, courses, rooms, or timetable.
4. Configure a mail provider if the institution needs email delivery. Signup requests remain `PENDING`; admin approval does not prove email ownership, so verify institutional identity out of band.
5. Confirm Supabase daily backups/PITR for the selected plan and perform an isolated restore drill before storing real student records.

## Release limits to resolve before broad institutional use

- The legacy server keeps the whole academic dataset in one JSONB row and one in-memory working copy; it requires a single instance and is not a multi-tenant 10,000-user architecture.
- The solver has local hard-constraint tests through 1,100 allocations, but no production load test for 10,000 concurrent students or the full target dataset.
- The current live Render deployment logged that `DATABASE_SSL_CA` was absent. Set it on the new service and verify the warning is gone.
- The Supabase Auth leaked-password protection setting is disabled on the currently connected project. Review/enable it in the new project if Supabase Auth password sign-in is used.
- Backups and restore have not been verified by an actual restore drill.
- Email delivery is not configured on the current presentation service.

This is a deployment boundary, not a claim of regulatory compliance or measured production capacity.
