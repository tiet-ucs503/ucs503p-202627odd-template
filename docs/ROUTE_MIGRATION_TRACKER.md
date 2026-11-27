# Milestone 9 — Normalized Backend Route Migration Tracker

Total normalized v2 FastAPI endpoints implemented across Batches 1–8: **44 endpoints** (0 route collisions; all protected endpoints enforce `require_roles` / `current_principal` + `principal.institution_id` tenant scoping + forced PostgreSQL RLS).

| Method | Normalized v2 Endpoint | Module | Verification Status |
| :--- | :--- | :--- | :--- |
| `GET` | `/v1/academic/courses` | `apps/api/app/academic.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/academic/courses` | `apps/api/app/academic.py` | Code Implemented (Staging DB Verification Pending) |
| `PATCH` | `/v1/academic/courses/{course_id}` | `apps/api/app/academic.py` | Code Implemented (Staging DB Verification Pending) |
| `DELETE` | `/v1/academic/courses/{course_id}` | `apps/api/app/academic.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/scheduling/generate` | `apps/api/app/scheduling.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/scheduling/versions/{version_id}/publish` | `apps/api/app/scheduling.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/scheduling/freeze-window/check` | `apps/api/app/scheduling.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/scheduling/cancellations` | `apps/api/app/scheduling.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/scheduling/recovery/opportunities` | `apps/api/app/scheduling.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/v1/catalog/departments` | `apps/api/app/routers/catalog_structure.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/catalog/departments` | `apps/api/app/routers/catalog_structure.py` | Code Implemented (Staging DB Verification Pending) |
| `DELETE` | `/v1/catalog/departments/{department_id}` | `apps/api/app/routers/catalog_structure.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/v1/catalog/programs` | `apps/api/app/routers/catalog_structure.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/catalog/programs` | `apps/api/app/routers/catalog_structure.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/v1/catalog/sections` | `apps/api/app/routers/catalog_structure.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/catalog/sections` | `apps/api/app/routers/catalog_structure.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/v1/resources/rooms` | `apps/api/app/routers/resources_and_allocations.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/resources/rooms` | `apps/api/app/routers/resources_and_allocations.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/v1/resources/time-slots` | `apps/api/app/routers/resources_and_allocations.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/resources/time-slots` | `apps/api/app/routers/resources_and_allocations.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/resources/availability` | `apps/api/app/routers/resources_and_allocations.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/timetable/sessions` | `apps/api/app/routers/timetable_ops.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/timetable/sessions/{session_id}/move` | `apps/api/app/routers/timetable_ops.py` | Code Implemented (Staging DB Verification Pending) |
| `PATCH` | `/v1/timetable/sessions/{session_id}/lock` | `apps/api/app/routers/timetable_ops.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/timetable/hod-approval` | `apps/api/app/routers/timetable_ops.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/timetable/admin-approval` | `apps/api/app/routers/timetable_ops.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/v1/voting/polls` | `apps/api/app/routers/voting_and_makeup.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/voting/polls` | `apps/api/app/routers/voting_and_makeup.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/voting/polls/{poll_id}/vote` | `apps/api/app/routers/voting_and_makeup.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/voting/polls/{poll_id}/apply` | `apps/api/app/routers/voting_and_makeup.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/attendance/sessions` | `apps/api/app/routers/attendance_and_exams.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/attendance/sessions/{attendance_session_id}/records` | `apps/api/app/routers/attendance_and_exams.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/exams/sessions` | `apps/api/app/routers/attendance_and_exams.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/v1/notifications` | `apps/api/app/routers/governance_finance_admin.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/notifications/{notification_id}/read` | `apps/api/app/routers/governance_finance_admin.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/announcements` | `apps/api/app/routers/governance_finance_admin.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/v1/governance/audit` | `apps/api/app/routers/governance_finance_admin.py` | Code Implemented (Staging DB Verification Pending) |
| `POST` | `/v1/finance/payments/callback` | `apps/api/app/routers/governance_finance_admin.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/v1/admin/users` | `apps/api/app/routers/governance_finance_admin.py` | Code Implemented (Staging DB Verification Pending) |
| `PATCH` | `/v1/admin/users/{user_id}/status` | `apps/api/app/routers/governance_finance_admin.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/health` | `apps/api/app/main.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/ready` | `apps/api/app/main.py` | Code Implemented (Staging DB Verification Pending) |
| `GET` | `/v1/me` | `apps/api/app/main.py` | Code Implemented (Staging DB Verification Pending) |
| `WEBSOCKET` | `/v1/ws/{institution_id}` | `apps/api/app/main.py` | Code Implemented (Staging DB Verification Pending) |
