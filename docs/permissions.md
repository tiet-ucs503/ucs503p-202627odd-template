# Permissions

Roles are stored in `intellischedule.users.role_code` and checked on the server for every request. The browser never chooses a role. Route guards are in `server.ts` (`requireAuth`, `requireRole`); per-item ownership checks are in `src/server/store.ts`. Changing a user's role, locking the account or resetting the password signs that user out everywhere.

Role groups used by the guards (`src/server/auth.ts`, `server.ts`):

- **Admin** = `SUPER_ADMIN`, `COLLEGE_ADMIN` (identical permissions)
- **Staff** = Admin + `COORDINATOR` + `HOD`
- **Coordination** = Admin + `COORDINATOR`
- **Teaching** = Coordination + `HOD` + `FACULTY`

## Matrix

Y = allowed, - = refused (403). "own" = restricted by the server to the user's own classes or section.

| Action (endpoint) | Admin | Coordinator | HOD | Faculty | CR | Student |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| Sign in, own profile, change own password, mark notification read | Y | Y | Y | Y | Y | Y |
| Load app data (`GET /api/academic/bootstrap`): timetable shown | all | all | own department | published schedule | own section | own section |
| Student roster, audit log, version details, solver benchmark | Y | Y | Y | - | - | - |
| Academic data create/update/delete, bulk groups, subgroups, academic year, Excel import, toggle soft constraints | Y | Y | - | - | - | - |
| Generate, select routine, move, swap, lock/unlock, restore version, set Draft/Review | Y | Y | - | - | - | - |
| Final approval / publish (`/api/timetable/approve`, `/api/timetable/publish`) | Y | Y (publish) | - | - | - | - |
| Department sign-off (`/api/timetable/department-approval`) | - | - | own department | - | - | - |
| Add a class (`POST /api/timetable/sessions`) | Y (draft) | Y (draft) | Y (draft) | own (live) | - | - |
| Cancel a class, accept or decline a make-up option | Y | Y | Y | own | - | - |
| Toggle unavailable periods | any faculty | any faculty | any faculty | own | - | - |
| Open / close a poll | any section | any section | any section | any section | own section | - |
| Vote or change own vote while open | - | - | - | - | own section | own section |
| Post a request / announcement | Y | Y | Y | Y | Y | - |
| Users & Roles, active sessions (`/api/admin/*`) | Y | - | - | - | - | - |

Notes:

- Adding a class: staff add to the working draft, which creates a new version. Faculty add a class for themselves to the published timetable (mirrored into the draft), and an in-app notification is posted.
- Faculty are matched to a faculty record by email; an account without a matching record gets 403 "not linked to a faculty record" for faculty actions.
- `GET /api/academic/bootstrap` is projected by role on the server: HOD sees the linked department; Student and CR see their linked section, own student record, related classes and notifications; Faculty receives schedule/occupancy data without the student roster or audit log. The separate academic catalog read endpoints are restricted to Admin, Coordinator, and HOD, with HOD results department-scoped. See [security/threat-model.md](security/threat-model.md).
- Admins cannot change their own role, lock themselves or delete their own account.

## Workspaces

The server returns the workspaces each role may open (`authorizedWorkspaces`); the UI switches between them without signing in again.

| Role | Workspaces |
| --- | --- |
| Super Admin, College Admin | Admin, Coordinator |
| Coordinator | Coordinator, Faculty |
| HOD | HOD, Faculty |
| Faculty | Faculty |
| Class Representative | Student, CR |
| Student | Student |

Workspaces only decide what the UI shows. What a user can change is decided by the matrix above, so an HOD in the HOD workspace can submit a department sign-off but cannot publish or edit master data.
