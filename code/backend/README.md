# Backend — Squat Form Analyzer API

FastAPI + SQLite backend: auth, session storage, dashboard aggregation, and
calibration baselines for the squat form-analysis app. Receives only
numeric/structured session summaries from the frontend — **no video or
image data ever reaches this service.**

## Setup

Requires Python 3.11+ (developed/tested on 3.13).

```bash
cd backend
python3.13 -m venv .venv        # or your Python 3.11+ interpreter
.venv/bin/pip install -r requirements.txt
```

## Run

```bash
cd backend
.venv/bin/uvicorn app.main:app --reload --port 8000
```

- API base: `http://localhost:8000/api`
- Interactive docs (Swagger UI): `http://localhost:8000/docs`
- SQLite file is created at `backend/data/app.db` on first run (gitignored).
- CORS is restricted to the Vite dev origin `http://localhost:5173` by
  default (see `app/config.py` / `APP_CORS_ORIGINS` env var).

From the repo root, `npm run dev:backend` / `npm run test:backend` run the
equivalent commands (see root `package.json`) — they assume the venv above
already exists at `backend/.venv`.

## Configuration

All settings are read via `pydantic-settings` from environment variables
prefixed `APP_`, or a `backend/.env` file (gitignored). Key ones:

| Env var                | Default                     | Purpose                          |
|-------------------------|------------------------------|-----------------------------------|
| `APP_DATABASE_URL`      | `sqlite:///./data/app.db`   | SQLAlchemy URL (swap dialect for Postgres later) |
| `APP_JWT_SECRET`        | dev-only insecure default   | **Override in any shared/deployed env** |
| `APP_JWT_ALGORITHM`     | `HS256`                     | JWT signing algorithm            |
| `APP_JWT_EXPIRE_MINUTES`| `1440` (24h)                 | Token lifetime                   |
| `APP_CORS_ORIGINS`      | `["http://localhost:5173"]` | Allowed frontend origins         |

## Tests

```bash
cd backend
.venv/bin/pytest          # or: .venv/bin/pytest -q
```

All tests run against an **in-memory SQLite** database (see
`app/tests/conftest.py`) via a FastAPI dependency override — they never
touch `backend/data/app.db`. Current status: **43/43 passing**.

## Layout

```
app/
  main.py          FastAPI app, CORS, router wiring, table creation on startup
  config.py        pydantic-settings (DB url, JWT secret/expiry, CORS origins)
  database.py      SQLAlchemy engine/session, Base, get_db dependency
  security.py      bcrypt password hashing, JWT create/decode, get_current_user
  models.py        SQLAlchemy models: User, Session, Rep, FormIssue, UserBaseline
  schemas.py       Pydantic request/response models (+ types.js field mapping)
  routers/
    auth.py        POST /api/auth/google, POST /api/auth/register, /api/auth/login
    sessions.py    POST/GET /api/sessions, GET /api/sessions/{id}
    dashboard.py   GET /api/dashboard/summary, /api/dashboard/trends
    calibration.py POST/GET /api/calibration
    health.py      GET /api/health
  services/
    validation.py  Cross-field session payload validation
    form_score.py  Server-side form_score recompute + tolerance check
    aggregation.py Dashboard summary/trends/improvement math
  tests/
    conftest.py         in-memory DB + TestClient fixtures, auth helpers
    test_auth.py
    test_sessions.py
    test_dashboard.py
    test_calibration.py
    test_form_score.py
```

## Data contract with the frontend

Request/response field names are snake_case mirrors of the camelCase
typedefs in `shared/exercise-config/types.js` (`SessionSummary`,
`RepMetrics`, `IssueRecord`, `UserBaseline`) — see the mapping table and
design notes at the top of `app/schemas.py`.

## Security model

- Passwords are hashed with `bcrypt` directly (not passlib — see
  `requirements.txt` for the passlib/bcrypt 4.1+ incompatibility this
  avoids), never stored or logged in plaintext.
- Every protected route depends on `get_current_user` (`app/security.py`),
  which decodes the JWT bearer token and loads the `User` row. Routers pass
  `current_user.id` into every query's `WHERE user_id = ...` filter — the
  request body/query string are never trusted for `user_id`. See
  `app/routers/sessions.py`, `dashboard.py`, `calibration.py`.
- Ownership violations (reading/mutating another user's data) return the
  same `404` as a nonexistent resource, never a `403` that would leak
  existence.
