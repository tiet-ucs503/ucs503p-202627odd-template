# Decisions

## 2026-11-24: phased platform migration

- **Decision:** Keep the current Vite/Express application and deployment intact while adding the specified Next.js/FastAPI platform under `apps/`.
- **Reason:** The requested target changes frontend framework, API runtime, auth authority, persistence model and hosting. Replacing the running app before equivalent workflows and rollback are verified risks losing existing capability.
- **Consequence:** Phase 0 foundations are separate and are not production-ready; routing/traffic cutover waits for parity and explicit deployment approval.
- **Decision:** Store app roles and institution membership in the `users` table. The verified JWT subject selects the active mapping; role authorization comes only from the database, never JWT/user-editable metadata.
- **Decision:** Put the initial institution/user/outbox schema in the separate, non-exposed `intellischedule_v2` schema. The connected Supabase project already has `public.institutions`, `public.profiles`, and the existing academic tables; the new foundation must not collide with or mutate those tables. Exposed Supabase roles `anon` and `authenticated` receive no grants on the new schema; server-side API access uses a dedicated restricted database role.
- **Decision:** API request code sets transaction-local auth-user and institution context after JWT verification. Forced RLS policies consume this context; the runtime connection must not be the table owner or have `BYPASSRLS`.

