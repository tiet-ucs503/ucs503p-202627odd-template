# MathVerse

Maths practice as superhero boss battles, with questions that adapt to how well
a student knows each topic and progress reports for parents and teachers.

Built for UCS503P Software Engineering (2026-27 ODD), Thapar Institute of
Engineering and Technology, Patiala.

## What it does

- **Students** fight six bosses, one per maths topic: linear equations, area and
  perimeter, sequences, percentages, exponents and roots, and ratios. Each boss
  is beaten with seven correct answers.
- **Questions adapt.** Each topic has easy, medium and hard questions. The next
  question's level depends on the student's mastery of that topic.
- **Hints on request.** Every question has a hint. If an AI key is configured,
  the hint is reworded in character; otherwise the built-in hint is shown.
- **Parents and teachers** link to a student with a code the student shares, and
  see accuracy, practice over time, mastery per topic, and earned badges. A
  parent can link several children; a teacher can link a class.
- **Optional attention estimate.** A student may switch on their webcam. The
  browser then estimates how often they were facing the screen. It is separate
  from everything academic and the game is identical without it.

## What the "AI" parts really are

| Part | What it is | What it is not |
|---|---|---|
| Mastery | Bayesian Knowledge Tracing: one probability per student per topic, updated from right and wrong answers only | Not a neural network; parameters are standard defaults, not fitted to data |
| Questions | Generated from random numbers with computed answers, checked by tests | Not written by a language model |
| Hints | A verified built-in hint, optionally reworded by a language model (Groq) | The model does not write the maths and the game does not depend on it |
| Attention estimate | MediaPipe face landmarks running in the browser: face present, head facing the screen, blink rate | Not eye tracking, not a medical or ADHD assessment, and never used for scoring |

More detail, including the mastery formulas and a worked example, is in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). How data and the camera are handled
is in [docs/PRIVACY.md](docs/PRIVACY.md).

## Tech stack

| Area | Tools |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, MediaPipe Tasks Vision |
| Backend | Python 3.10+, FastAPI, SQLAlchemy, SQLite, bcrypt, JWT |
| Tests | pytest (backend), Vitest and React Testing Library (frontend) |

## Run it locally

You need Python 3.10 or newer and Node.js 18 or newer.

### 1. Backend

```bash
cd backend
python -m venv venv
```

Activate the environment: `venv\Scripts\activate` on Windows, or
`source venv/bin/activate` on macOS and Linux. Then:

```bash
pip install -r requirements.txt
```

Create `backend/.env` by copying `backend/.env.example`, and set
`JWT_SECRET_KEY` to a long random string. This prints one:

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Start the server:

```bash
uvicorn main:app --port 8001 --reload
```

The API is at `http://localhost:8001` and its interactive docs at
`http://localhost:8001/docs`. The database file `backend/mathverse.db` is
created on first start.

### 2. Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

### 3. Optional settings (`backend/.env`)

| Setting | Effect |
|---|---|
| `DEMO_MODE=true` | Shows one-click demo buttons on the sign-in dialog. Run `python seed.py --demo` once first to create the three demo accounts with sample data. Off by default. |
| `GROQ_API_KEY=...` | Lets a language model reword hints in character. Without it the built-in hints are used. |
| `CORS_ORIGINS=...` | Comma-separated frontend addresses allowed to call the API. |

## Try it

1. Sign up as a student and start the first mission. Choose whether to use the
   camera; either choice gives the same game.
2. Answer a few questions. The level (easy, medium, hard) follows your answers.
3. Open your dashboard and copy your link code.
4. In another browser profile, sign up as a parent and enter that code to see
   the report.

## Tests

```bash
cd backend
pytest
```

```bash
cd frontend
npm run test
npm run typecheck
npm run lint
npm run build
```

The backend suite covers sign-in and access control, the demo-login
restrictions, the game rules, the mastery model, the correctness of every
question type at every level, hints, and reports checked against hand-computed
values. The frontend suite covers the camera consent flow (declining, denial,
switching off mid-mission, and that no image is ever uploaded) and the
dashboards. The same checks run in GitHub Actions on every push.

## Project layout

```
backend/
  main.py            app and routes wiring
  config.py          settings from environment / .env
  models.py          database tables
  schemas.py         request and response shapes
  security.py        password hashing and login tokens
  deps.py            who is calling and what they may see
  seed.py            demo accounts (--demo) and database reset (--reset)
  routers/           auth, sessions (gameplay), guardians, reports
  services/          questions, mastery, hints, attention, game rules, report builder
  tests/
frontend/src/
  lib/api.ts         the one client for the backend
  lib/attention/     in-browser camera tracking and its summary
  context/           sign-in state and game progress
  components/        screens; dashboard/ holds the report and charts
docs/
  ARCHITECTURE.md    how it works and how to explain it
  PRIVACY.md         what is collected and what is not
  AUDIT_AND_PLAN.md  the audit this version was built from
journals/, project-proposal/, project-report-prototype-stage/, srs/   coursework
```

## Known limits

- The attention estimate has been tested with a simulated camera. Its
  thresholds have not been tuned on real webcams. The checklist for testing
  on real devices is in `docs/WEBCAM_TEST_PLAN.md`; it has not been run yet.
- Mastery parameters are textbook defaults; with them, mastery moves quickly.
- The camera choice is made by whoever is using the device. This is suitable
  for a course demo; see "Before real deployment" in
  [docs/PRIVACY.md](docs/PRIVACY.md).
- Fonts are loaded from Google Fonts.
- Spider-Man and related characters belong to Marvel. They are used here in a
  non-commercial course project; the project is not affiliated with or endorsed
  by Marvel and should not be deployed publicly as it stands.
