# Public demo access

The current presentation deployment deliberately exposes one-click Student, Faculty, HOD, Coordinator, and Admin demo access. This is for presentations with synthetic data only.

## Permissions and data boundaries

- Demo identities go through the normal server-side role and permission checks.
- The demo Admin has normal Admin permissions. The Coordinator has normal Coordinator permissions. `isDemoUser` does not make their data or actions read-only.
- Demo users and real users share the same application database on a given deployment. Academic edits, timetable changes, notifications, and account administration are therefore shared within that deployment.
- **Do not add real student or institutional records to the presentation deployment.** The demo reset restores the academic sample dataset and resets the five demo accounts' password/status; it does not reverse account administration, restore arbitrary user records, or isolate demo changes from real records.
- The demo password is deployment configuration (`DEMO_ACCOUNT_PASSWORD`). Do not put its value in source control or public documentation. Reviewers should use the one-click demo buttons.
- Google sign-in is independent from demo access.

## Demo roles

| Role | Account | Purpose |
| --- | --- | --- |
| Coordinator | `coordinator.demo@demo.thapar.local` | Schedule setup, generation, review, and publishing |
| Faculty | `faculty.demo@demo.thapar.local` | Teaching schedule, availability, and cancellations |
| Student | `student.demo@demo.thapar.local` | Student timetable and notifications |
| Admin | `admin.demo@demo.thapar.local` | Governance, user administration, and final approval |
| HOD | `hod.demo@demo.thapar.local` | Department workload and syllabus views |

## Keep presentations and real production separate

The presentation app may keep all five demo roles enabled. A real production app must use its own app deployment and its own Supabase project/database. Do not point the presentation app at the real production database. On the real production app, set `PUBLIC_DEMO_ENABLED=false` and `ALLOW_DEMO_IN_PRODUCTION=false`; do not seed demo or sample users into that database.

Both flags must be true for public demo access in a production-mode deployment. With either false, demo status/login are unavailable. Changing these flags requires a deployment/restart to take effect.

## Reset

An authenticated demo account may call `POST /api/demo/reset`. It restores the academic sample dataset and restores the five demo accounts' password/status fields. It is a presentation reset, not a production recovery or tenant-isolation mechanism.
