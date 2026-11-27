# Rollback

## Application (bad release)

Send traffic back to the previous Cloud Run revision:

```bash
gcloud run revisions list --service intellischedule --region asia-south1
gcloud run services update-traffic intellischedule --region asia-south1 --to-revisions <previous-revision>=100
```

On another host, run the previous image tag again. Data stays where it is (Supabase). The schema file only uses `create ... if not exists`, so an older image starts against the same database as long as no release has changed the schema destructively. Check `curl -fsS <APP_URL>/api/health/ready` afterwards.

While traffic is pinned to a revision, new deploys do not receive traffic. After deploying a fixed release, run `gcloud run services update-traffic intellischedule --region asia-south1 --to-latest`.

## Timetable (bad generation, edit or publish)

Every generation and manual edit is a numbered version, and versions are never deleted.

1. Coordinator: Audit & Governance -> Timetable Version History -> **Restore This Version**. This makes it the working draft; students still see the current published timetable.
2. Admin: publish. Publishing is refused if the restored draft has hard violations against the current academic data (e.g. a room was deleted since); fix those first.

Cancellations and make-up classes made after that version are not in it.

## Academic data (bad import or bulk change)

There is no undo for master data; the audit log shows what changed and who did it.

- Re-import a correct workbook (`replace` mode replaces faculty, rooms, courses, groups, allocations and students), or fix records by hand.
- Or restore the database to a point before the change (Supabase point-in-time recovery or a backup, see [backups.md](backups.md)). This resets **everything**, including users, sessions, timetable versions and the audit log, to that time. Restart the app afterwards so it reloads.

## Security incident

- Sign out one user: Admin -> Users & Roles -> sign out everywhere (or lock the account).
- Sign out everyone: `delete from intellischedule.auth_sessions;` in the Supabase SQL editor. Restarting the app does not end sessions (they are stored in the database).
- Lock demo accounts: `update intellischedule.users set status = 'LOCKED' where is_demo;` and set `DEMO_MODE=false`.
- Rotate secrets: change the Supabase database password and the Google client secret, update the Secret Manager versions, and deploy a new revision so it reads them.
