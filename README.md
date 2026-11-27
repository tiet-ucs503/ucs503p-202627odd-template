## Overview

**IntelliSchedule** is an enterprise academic scheduling and university operations platform engineered for large institutions (designed for 50,000+ students across multiple departments, programs, sections, and laboratories). It unifies **constraint-based timetable generation**, **real-time multi-device synchronization**, **self-healing class cancellation recovery**, **student makeup voting**, **syllabus progress tracking**, **configurable faculty workload governance**, and **isolated What-If impact simulation** behind a single authoritative PostgreSQL architecture.

### Active Institutional Dataset (`third_year_computer_synthetic_dataset.xlsx`)

| Metric | Count | Details | 
| ----- | ----- | ----- | 
| **Branches / Departments** | 4 | Third-Year Computer Engineering, CSE, AI & ML, CSBS | 
| **Courses** | 37 | `UAI501`–`UTD004` (Core + Elective, Lecture/Tutorial/Lab) | 
| **Faculty Members** | 149 | `AA`–`YK` with weekly teaching caps & subject qualifications | 
| **Rooms & Laboratories** | 60 | Lecture halls (`≤250`) and Labs (`≤30`), `B303`–`T106` | 
| **Student Subgroups** | 68 | `3C11`–`3R13` mapped to lecture & practical groups | 
| **Students** | 1,847 | `SYN26-0001`–`SYN26-1847` with elective & group tags | 
| **Time Slots** | 14 / day | 50-minute periods (`08:00`–`19:40`, Monday–Friday) | 
| **Published Sessions** | 617 | Independently verified with **0 hard conflicts** | 

## System Architecture (HLD)

```
flowchart TB
  subgraph Clients["Multi-Device Real-Time Portals"]
    A[Admin Portal]
    H[HOD Portal & Timetable Generator]
    F[Faculty Portal]
    C[CR Portal]
    S[Student Portal]
  end

  subgraph Edge["API Gateway & Real-Time Layer"]
    GW[HTTPS · Token-Bucket Rate Limiter · GZip · Idempotency-Key · CSRF]
    RT[Targeted SSE / WebSocket Hub · Last-Event-ID Replay · Event Dedup]
  end

  subgraph Core["Modular Domain Services (54 Normalized v2 Endpoints)"]
    AUTH[Identity, JWT/Cookie Auth & RBAC]
    CAT[Academic Catalog & 50k Student Importer]
    SOLV[Scheduling Engine · DSatur · CP-SAT · What-If Simulator]
    OPS[Cancellation Recovery · CR Polls · Atomic Apply Winner]
    ACAD[Syllabus Progress · Workload Policies · Attendance · Exams · Finance]
  end

  subgraph Data["Authoritative Persistence & Async Messaging"]
    PG[(PostgreSQL 16 · Forced Tenant RLS · Partial Unique Indexes)]
    CACHE[(Tagged LRU + TTL Cache)]
    OUTBOX[(Transactional Outbox · SKIP LOCKED Worker · DLQ)]
  end

  Clients --> GW & RT
  GW --> AUTH & CAT & SOLV & OPS & ACAD
  SOLV & OPS & ACAD --> PG
  PG -->|pg_notify LISTEN/NOTIFY| RT
  PG --> OUTBOX --> RT
  CAT & SOLV --> CACHE

```

## Core Scheduling Pipeline & Cross-Portal Flow

### 1. Three-Alternative Timetable Optimization Pipeline

```
flowchart LR
  D[Dataset Validation] --> G[Session Generator]
  G --> CG[Conflict Graph Engine]
  CG --> DS[DSatur + MRV Ordering]
  DS --> OPT[3 Distinct Runs: Student / Faculty / Balanced]
  OPT --> VAL[Independent Hard-Constraint Validator]
  VAL --> HS[Timetable Health Score 0–100]
  HS --> PUB[HOD Review & Immutable Publish]

```

### 2. Multi-Device Cancellation, CR Voting & Apply Winner Sequence

```
sequenceDiagram
  participant FAC as Faculty Device
  participant API as Centralized Backend
  participant DB as PostgreSQL (ACID + FOR UPDATE)
  participant RT as Targeted SSE Hub
  participant HOD as HOD Device
  participant CR as CR Device
  participant STU as Student Devices

  FAC->>API: Cancel Scheduled Class
  API->>DB: Mark CANCELLED + Create MakeupTask + AuditLog + Outbox
  API->>RT: Push targeted event (Department + Section only)
  RT-->>HOD: Live cancellation alert + recovery options
  RT-->>STU: Live timetable update (0 refresh needed)
  CR->>API: Publish Makeup Poll (proposed slots)
  RT-->>STU: Section-scoped voting notification
  STU->>API: Concurrent Votes (1 active vote/student, auditable)
  HOD->>API: Apply Winner (POST /api/voting/polls/:id/apply)
  API->>DB: Lock poll FOR UPDATE -> Re-validate faculty/room/section -> Insert Makeup + Attendance Session
  RT-->>FAC: Confirmed makeup schedule
  RT-->>STU: Updated timetable + confirmation alert

```

## Algorithms & Mathematical Formulas

### 1. Conflict Graph & DSatur + MRV Heuristic

Each required teaching hour is expanded into a session vertex $v \in V$. An undirected conflict edge $(u, v) \in E$ exists whenever two sessions share a faculty member, a student section/subgroup, or a specialized lab resource.

At each step, **DSatur** selects the unscheduled session maximizing saturation degree $\text{sat}(v)$ (distinct time slots already occupied by neighbors), breaking ties by graph degree $\deg(v)$ and smallest feasible domain $\vert{}D(v)\vert{}$:

$$
v^* = \arg\max_{v \in U} \Big(\text{sat}(v),\; \deg(v),\; -\vert{}D(v)\vert{}\Big)
$$

Hard feasibility at candidate slot $t$ and room $r$ is verified in $O(1)$ using bitsets / indexed occupancy sets:

$$
M_{\text{faculty}}(f, t) = 0 \;\land\; M_{\text{section}}(s, t) = 0 \;\land\; M_{\text{room}}(r, t) = 0 \;\land\; \text{cap}(r) \ge \text{size}(s)
$$

Three genuinely distinct alternatives are generated using separate optimization profiles and deterministic seeds (`1337` Student-Centric, `9999` Faculty-Workload, `20261` Balanced Resource Utilization).

### 2. Timetable Health Score ($0\text{–}100$)

$$
H = 0.35\,S_{\text{conflict}} + 0.20\,S_{\text{faculty}} + 0.20\,S_{\text{student}} + 0.15\,S_{\text{room}} + 0.10\,S_{\text{stability}}
$$

Where:

* $S_{\text{conflict}} = \max(0,\; 100 - 25 \cdot V_{\text{hard}})$ — publishing is strictly blocked whenever $V_{\text{hard}} > 0$.

* $S_{\text{faculty}} = \frac{N_{\text{pref\_hits}}}{N_{\text{sessions}}} \times 100$ — alignment with faculty preferred slots and workload caps.

* $S_{\text{student}} = \max(0,\; 100 - 4 \cdot G_{\text{student}})$ — penalizes idle gaps between classes on the same day.

* $S_{\text{room}} = \frac{1}{\vert{}S\vert{}} \sum_{s \in S} \min\!\left(1,\; \frac{\text{students}(s)}{\text{capacity}(r_s)}\right) \times 100$ — classroom seat utilization efficiency.

* $S_{\text{stability}} = \frac{N_{\text{unchanged}}}{N_{\text{sessions}}} \times 100$ — minimal disruption relative to the previous published version.

### 3. Dual Syllabus Progress Formulas

Cancelled sessions are **never** counted as completed teaching hours or syllabus completion:

$$
P_{\text{topic}} = \frac{\sum_{t \in \mathcal{T}_{\text{completed}}} w_t}{\sum_{t \in \mathcal{T}_{\text{all}}} w_t} \times 100 \qquad\qquad P_{\text{session}} = \frac{N_{\text{completed\_sessions}}}{N_{\text{planned\_sessions}}} \times 100
$$

### 4. Self-Healing Recovery & Cross-Cancellation Score

$$
S_{\text{match}}(m, t, r) = \min\!\Big(100,\; B_{\text{strategy}} + \min\big(8,\; 1.5 \cdot V_{\text{student}}(t)\big)\Big)
$$

Where $B_{\text{strategy}} = 92$ for **Cross-Cancellation** (reusing a slot freed by another cancelled session), $88$ for **Same-Day** recovery, and $78$ for a conflict-free **Future Slot**.

### 5. Timetable Freeze Window Governance

$$
\text{Policy}(\Delta t) = \begin{cases} \text{LOCKED (Strict Override Required)} & \Delta t < 24\text{ hours} \\ \text{APPROVAL\_REQUIRED (Incremental Only)} & 24\text{ h} \le \Delta t \le 72\text{ h} \\ \text{FLEXIBLE (General Scheduling)} & \Delta t > 72\text{ hours} \end{cases}
$$

### 6. API Gateway Token-Bucket Rate Limiter

$$
T_{\text{now}} = \min\!\Big(C,\; T_{\text{prev}} + (t_{\text{now}} - t_{\text{prev}}) \cdot r\Big), \qquad \text{Retry-After} = \left\lceil \frac{\text{cost} - T_{\text{now}}}{r} \right\rceil
$$

## Role-Based Access Control (RBAC)

| Role | Account Activation | Core Capabilities | 
| ----- | ----- | ----- | 
| **Super Admin / Admin** | Server bootstrap secret / Admin-created | Dynamic role management (`Student ↔ CR`, `Faculty`, `HOD`), account status, final approvals, audit logs | 
| **HOD** | Admin-approved | Timetable Generator (3 alternatives), publish/unpublish, HOD Portal, What-If Simulator, polls, Apply Winner, workload & syllabus oversight | 
| **Faculty** | Admin-approved | Weekly teaching timetable, class cancellation (notifies HOD + students), syllabus topic updates, attendance | 
| **Class Representative (CR)** | Promoted from Student by Admin | Section timetable, launch makeup polls, voting, disruption alerts | 
| **Student** | Automatic enrollment-linked activation | Published section timetable, live SSE updates, makeup poll voting (1 vote/student), attendance & exams | 

## Database Architecture & Migrations (`intellischedule_v2`)

Seven reversible Alembic migrations (`0001`–`0007`) enforce **PostgreSQL Forced Row-Level Security (RLS)** on every table, database-level partial unique conflict indexes (`tt_sessions_no_faculty_clash_uq`, `tt_sessions_no_room_clash_uq`, `tt_sessions_no_section_clash_uq`), idempotent payment/attendance uniqueness, and zero-downtime `CREATE INDEX CONCURRENTLY` indexing (`0006`).

## Quick Start & Staging Deployment

### 1. Local Full-Stack Development

```
npm install
npm run dev

```

Open `http://127.0.0.1:3000` (or `http://<your-local-ip>:3000` across multiple devices on the same network).

### 2. Two-Instance Staging Stack (Docker + PostgreSQL 16 + FastAPI + Worker)

```
docker compose -f docker-compose.staging.yml up -d --build
cd apps/api
pip install -r requirements.lock && pip install --no-deps .
alembic upgrade head
python -m scripts.load_third_year_dataset
python -m scripts.verify_staging_cutover
ruff check app migrations scripts tests && pytest

```

### 3. Frontend Verification, Playwright E2E & k6 Load Testing

```
npm run lint && npm test && npm run build
BASE_URL=http://127.0.0.1:3000 npx playwright test tests/e2e_multi_device.playwright.ts
BASE_URL=http://127.0.0.1:8001 TARGET_VUS=1000 k6 run tests/load/k6_university_load.js

```

## Project Team

Built with engineering rigor at **Thapar Institute of Engineering and Technology (TIET), Patiala**:

| \# | Team Member | Roll Number | 
| ----- | ----- | ----- | 
| **1** | **Uddeshya Kumar** | `1024031184` | 
| **2** | **Sahibjot Singh** | `1024030559` | 
| **3** | **Sparsh Gupta** | `1024030557` | 
| **4** | **Tamana** | `1024030566` | 
| **5** | **Aarav** | `1024030482` | 
