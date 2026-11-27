# System Design — IntelliSchedule (University Academic Operations & Timetable Platform)

**Institution Target**: Thapar Institute of Engineering and Technology (TIET, Patiala)  
**Scope**: Institutional Academic Scheduling & Operations Architecture  
**Version**: 1.0.0 (Production Architecture)

---

## 1. Problem Definition & Domain Scope

Universities experience high-frequency schedule disruptions (faculty conference travel, guest lectures, medical leaves, equipment failures) coupled with tight accreditation requirements (minimum teaching hours, continuous syllabus progression, student attendance quorum). Traditional static timetables fail to self-heal when unexpected cancellations occur, forcing ad-hoc manual rescheduling that causes cascading conflicts across shared laboratories, student cohorts, and faculty blocks.

**IntelliSchedule** is a resilient, multi-tenant university academic setup, conflict-free timetable generation, and autonomous dynamic recovery platform.

---

## 2. Personas & RBAC Authorization Matrix

| Role | Primary Responsibilities & Permitted Actions | Workspaces Accessible |
| :--- | :--- | :--- |
| **Timetable Coordinator** | Master academic configuration (Years, Semesters, Working Days, Periods, Departments, Programs, Courses, Rooms, Labs, Sections, Allocations, Hard/Soft Constraints), Pre-generation validation audit, Draft generation, Schedule review & publishing. | `Coordinator`, `Faculty` |
| **Faculty Member** | View teaching schedule, define protected research blocks, manage class cancellations, review and accept self-healing makeup opportunities, claim open recovery slots, request peer substitution. | `Faculty` |
| **Class Representative (CR)** | View section timetable, monitor makeup proposals, coordinate student quorum polls, submit makeup petitions on behalf of student cohort. | `Student`, `CR` |
| **Student** | View personalized live schedule, receive room change/cancellation notifications, participate in makeup slot consensus polls. | `Student` |
| **Admin / Dean of Academic Affairs** | Final timetable approvals, cross-department governance, multi-solver benchmarks, regulatory compliance audits, audit logs inspection. | `Admin`, `Coordinator` |

---

## 3. Core Academic Workflow

```
[ Academic Setup ]
  ├─ Academic Year & Semester Configuration (Periods, Breaks, Lunch)
  ├─ Department & Program Management
  ├─ Course Catalog (Lecture / Tutorial / Lab weekly quotas)
  ├─ Faculty Directory & Teaching Workload Limits
  ├─ Room & Laboratory Asset Registry (Capacities & Equipment)
  ├─ Student Sections & Subsections
  └─ Course-Faculty-Section Allocations & Constraints
          │
          ▼
[ Validation Audit Engine ]
  ├─ Pre-generation Hard Constraint Audit (Zero Error Gate)
  └─ UGC Faculty Workload & Room Capacity Verification
          │
          ▼
[ Constraint Satisfaction Generator ]
  ├─ Integer Mapping across 3D Domain (Faculty × Room × Section × Time)
  └─ Generates Conflict-Free Master Draft Timetable
          │
          ▼
[ Review, Approval & Lifecycle ]
  └─ Draft ──► Coordinator Review ──► Dean Approval ──► Published
```

---

## 4. Capacity Estimates & Non-Functional Targets

| Metric | Baseline Target (TIET Scale) | 10× Scaling Limit | 100× Scaling Limit |
| :--- | :--- | :--- | :--- |
| **Registered Students** | 12,000 | 120,000 | 1,200,000 |
| **Faculty Members** | 650 | 6,500 | 65,000 |
| **Rooms & Laboratories** | 350 | 3,500 | 35,000 |
| **Concurrent Class Sessions** | ~280 / hour | ~2,800 / hour | ~28,000 / hour |
| **API Response Latency (p95)** | < 45 ms | < 80 ms | < 120 ms |
| **Timetable Generation Time** | < 150 ms | < 900 ms | < 4,500 ms |
| **Availability (SLA)** | 99.95% | 99.95% | 99.99% |
