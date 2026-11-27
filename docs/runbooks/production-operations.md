# IntelliSchedule — Production Operations, Backup & Incident Runbook

## 1. Automated Backups & Point-in-Time Recovery (PITR)
- Enable daily automated PostgreSQL snapshots + WAL archiving (PITR) on Supabase/managed Postgres.
- Monthly restore drill: restore latest snapshot into a disposable staging database, run `python -m scripts.verify_staging_cutover`, and verify `alembic_head`, forced RLS, and all 21 valid indexes.

## 2. Failed Migration Recovery
- Migrations `0001`–`0006` each provide a `downgrade()` path.
- If `0006` (`CREATE INDEX CONCURRENTLY`) is interrupted, check for invalid indexes:
  `SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE NOT i.indisvalid;`
  Drop any invalid index with `DROP INDEX CONCURRENTLY` and re-run `alembic upgrade head`.

## 3. Server Crash / Lost SSE Connections / Failed Notifications
- **SSE reconnect:** Browsers automatically send `Last-Event-ID`; `server.ts` replays missed authorized events from its ring buffer and `TimetableContext` runs a full bootstrap catch-up on reconnect.
- **Failed notifications / Outbox DLQ:** Query `SELECT * FROM intellischedule_v2.event_outbox WHERE status = 'DEAD_LETTER' ORDER BY created_at DESC;`, inspect failure cause, and reset `status = 'PENDING', attempts = 0, available_at = now()` to replay.
- **Duplicate payment callbacks:** Handled automatically via unique `(institution_id, idempotency_key)` on `payment_transactions`; verify no double-credit via `SELECT invoice_id, COUNT(*) FROM intellischedule_v2.payment_transactions GROUP BY invoice_id, idempotency_key HAVING COUNT(*) > 1;`.
