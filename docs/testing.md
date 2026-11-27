# Testing & Verification Strategy — IntelliSchedule

**Standard**: Proportional Verification Hierarchy & Anti-Truncation Quality Gate  
**Execution Command**: `npm test` (`tsx scripts/run_e2e_tests.ts`)

---

## 1. Test Suite Architecture

The automated test suite evaluates all layers of the platform:

```
[ Automated Test Runner (scripts/run_e2e_tests.ts) ]
  ├── 1. Authentication & Security Test Suite
  │     ├── Empty credentials validation (400)
  │     ├── Invalid credentials rejection (401)
  │     ├── Non-existent user anti-enumeration (401)
  │     ├── Coordinator multi-role resolution (Coordinator + Faculty)
  │     ├── Student multi-role resolution (Student + CR)
  │     ├── Session token verification (/api/auth/me)
  │     ├── Unauthenticated request rejection (401)
  │     ├── User registration workflow (201)
  │     ├── Duplicate registration prevention (409)
  │     ├── Password reset lifecycle (Forgot -> Validate -> Reset -> Login)
  │     └── Session logout & immediate token revocation
  │
  ├── 2. Google OAuth 2.0 Security Audit
  │     ├── Status endpoint validation
  │     └── Minimal scope enforcement (openid, email, profile only)
  │
  └── 3. Timetable Constraint & Generation Engine
        ├── Hard Constraint: Faculty simultaneous teaching collision
        ├── Hard Constraint: Room double-booking collision
        ├── Hard Constraint: Student section cohort class collision
        ├── Hard Constraint: Seating capacity exceedance check
        └── Master Timetable Generation (22 conflict-free sessions)
```

---

## 3. Large-Scale Benchmarks & Performance Verification (300 to 1,500 Allocations)

The scheduling engine has been benchmarked on production-scale synthetic workloads ranging from 300 to 1,500 allocations with O(1) indexed Map lookups and Simulated Annealing optimization:

| Scale | Allocations | Execution Time (ms) | Feasible | Hard Violations |
| :--- | ---:| ---:| :---: | ---:|
| Scale 300 | 300 | 9.44 ms | Yes | 0 |
| Scale 600 | 600 | 31.35 ms | Yes | 0 |
| Scale 1000 | 1000 | 62.18 ms | Yes | 0 |
| Scale 1500 | 1500 | 134.50 ms | Yes | 0 |

- **Asynchronous Job API**: `POST /api/timetable/jobs` enqueues generation jobs, returning `{ jobId, status: 'PENDING' }`. Status and results are polled via `GET /api/timetable/jobs/:id`, and execution can be terminated via `POST /api/timetable/jobs/:id/cancel`.
- **Determinism**: Seeded PRNG ensures 100% byte-for-byte JSON equality across repeated executions with the same input and seed.
