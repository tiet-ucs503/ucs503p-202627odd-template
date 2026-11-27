# Backups

## What is stored where

| Data | Location |
| --- | --- |
| Accounts, sessions, Google sign-in states | Supabase Postgres, `intellischedule.users`, `auth_sessions`, `oauth_states` |
| Academic data, student roster, working draft and published timetable, notifications, make-ups, polls and votes | `intellischedule.app_state` (four JSONB documents) |
| Every timetable version | `intellischedule.timetable_versions` |
| Audit trail | `intellischedule.audit_log` |
| Rate-limit counters | Process memory only (lost on restart, nothing to back up) |
| Secrets (database URL, Google secret, CA) | Secret Manager / host environment, not in the database |

The container keeps no state, so the database is the only thing to back up. Local development data is in `./.data/pglite` (not backed up).

## Supabase backups

Supabase takes daily backups on paid plans, and point-in-time recovery (PITR) is a paid add-on. Retention depends on the plan; check Dashboard -> Database -> Backups for what your project has. On the Free plan, take your own dumps.

## Own dump

Use the **Session pooler** or direct connection string (port 5432); `pg_dump` does not work through the transaction pooler.

```bash
pg_dump "$SESSION_DATABASE_URL" --schema=intellischedule -Fc -f intellischedule-$(date +%F).dump
```

The dump contains password hashes and session hashes; store it like a secret.

## Restore

1. Stop traffic or accept that changes made after the backup point are lost.
2. Restore with Supabase (Backups / PITR) or from a dump:

   ```bash
   pg_restore --clean --if-exists -d "$SESSION_DATABASE_URL" intellischedule-YYYY-MM-DD.dump
   ```

3. Restart the app so it reloads its in-memory copy (Cloud Run: deploy a new revision, e.g. `gcloud run services update intellischedule --region asia-south1 --update-env-vars RESTARTED_AT=$(date +%s)`).
4. Check `/api/health/ready`, sign in, and confirm the timetable and latest audit entries are what you expect.

A restore also brings back old sessions and passwords as of the backup time. After a security incident, run `delete from intellischedule.auth_sessions;` once restored.

To undo a single timetable change, restoring a version in the app is usually enough; see [rollback.md](rollback.md).
