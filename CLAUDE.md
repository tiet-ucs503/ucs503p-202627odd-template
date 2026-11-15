# MathVerse

Gamified maths practice for school students, with adaptive difficulty, optional
in-browser attention estimates, and parent/teacher dashboards. A course project
(UCS503P, TIET). It handles children's data, so the rules below matter.

Read first: `docs/ARCHITECTURE.md` (how it works), `docs/PRIVACY.md` (what is
collected), `docs/AUDIT_AND_PLAN.md` (why it is built this way).

## Commands

Backend, from `backend/` (virtual environment in `backend/venv`):

```bash
venv\Scripts\activate
pytest
uvicorn main:app --port 8001 --reload
python seed.py --demo      # create the three demo accounts (needs DEMO_MODE=true to log in)
python seed.py --reset     # wipes ALL data; ask before running
```

Frontend, from `frontend/`:

```bash
npm run dev
npm run test
npm run typecheck
npm run lint
npm run build
```

`backend/.env` must contain `JWT_SECRET_KEY`. Tests set their own secret and use
an in-memory database, so they need no `.env`.

Before saying work is done, run `pytest` and, for frontend changes,
`npm run test`, `npm run typecheck` and `npm run lint`.

## Layout

- `backend/routers/` — `auth`, `sessions` (gameplay), `guardians`, `reports`
- `backend/services/` — `questions` (generator), `mastery` (BKT), `hints`,
  `attention`, `game` (scoring rules), `report_builder`, `curriculum`
- `backend/deps.py` — who is calling and what they may see
- `frontend/src/lib/api.ts` — the only place that calls the backend
- `frontend/src/lib/attention/` — camera tracking; `detector.ts` is the only
  file that touches MediaPipe
- `frontend/src/components/dashboard/` — the parent/teacher report and charts

## Rules that must not be broken

1. **The server owns the truth.** It generates questions, keeps the answer,
   judges it, and awards points, levels and unlocks. Never trust a score,
   points value or user id sent by the client. Identity comes only from the
   bearer token (`deps.current_user`).
2. **The camera is always optional and stays in the browser.** No image or
   video is stored, drawn to a canvas, or uploaded. Only the four-number
   summary is sent. Do not add any endpoint or field that could carry image
   data; request schemas use `extra="forbid"`.
3. **Attention never affects anything academic.** Mastery, difficulty, points,
   unlocks, hints and report observations must not read attention data.
   `mastery.update_mastery(p_mastery, is_correct)` and `hints.hint_for(...)`
   have no attention parameter; keep it that way.
4. **Missing attention data is NULL, meaning "not measured".** Never convert it
   to 0, a default, or a label, and leave it out of averages.
5. **Nothing is fabricated.** Every dashboard number comes from stored rows. No
   sample values, hardcoded badges, or invented summaries. Empty data shows an
   empty state.
6. **No medical claims.** Never describe the attention estimate as diagnosing
   ADHD or any condition, or as a measure of ability. It is "an estimate, not a
   medical assessment".
7. **Demo login** stays off by default (`DEMO_MODE=false`), returns only seeded
   `is_demo` accounts, never creates users, and demo and real accounts are never
   linked.
8. **Questions are deterministic.** The generator computes each answer. A
   language model may only reword an existing verified hint; it never writes
   questions or maths, and the game must work with no `GROQ_API_KEY`.
9. **Guardians see a student only through a link** made with that student's link
   code. Use `deps.student_for_viewer` for any endpoint that returns a
   student's data.

Tests enforce most of these (T1–T12, mapped in `docs/ARCHITECTURE.md`). If a
change makes one of those tests fail, the change is wrong, not the test.

## Conventions

- Keep it simple and explainable; this is a student project, not enterprise
  software. Prefer fixing over rewriting, and avoid new dependencies.
- Backend: flat modules, routers stay thin, logic lives in `services/`.
- Frontend: all requests go through `api()` in `lib/api.ts`; shared state lives
  in `AuthContext` and `GameContext`; only the login token is kept in
  `localStorage`.
- Mastery uses BKT with the learning step applied only after correct answers
  (a deliberate change from textbook BKT, documented in `services/mastery.py`).
  Do not "fix" it back.
- Write tests with the feature. New question types need a case in
  `tests/test_questions.py::solve`.
- Charts are single-series inline SVG in `TrendCharts.tsx`; no chart library.

## Working rules for this repository

- `origin` is a shared team repository. **Never push without explicit
  permission.** Local commits are fine.
- Do larger pieces of work on a branch, stop when a piece is finished, and
  report: files changed, what was implemented, tests run and their results,
  remaining issues, and how to test by hand.
- Never drop an agreed requirement silently. If something conflicts, say so and
  propose a resolution.
- Secrets live in `backend/.env` (git-ignored). Never print or commit them.
  `*.db` files are git-ignored and must stay that way.

## Known gaps

- Real-device camera checklist: `docs/WEBCAM_TEST_PLAN.md` (not yet run).
  `?attentionDebug=1` shows a text-only readout of the live numbers for it.
- The camera path has only been tested with a simulated camera; head-angle
  thresholds in `lib/attention/summary.ts` are untuned.
- BKT parameters are textbook defaults, so mastery can swing to 1% or 99%
  quickly.
- Camera consent is per device; real use with children needs verified
  parent/guardian consent and controls (see `docs/PRIVACY.md`).
- Fonts load from Google Fonts. Character names and artwork belong to Marvel.
