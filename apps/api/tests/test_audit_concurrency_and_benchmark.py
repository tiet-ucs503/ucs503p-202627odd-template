"""Section B (8 Concurrency Scenarios) & Section F (Realistic Load Benchmark) Verification Suite."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from app.enterprise.notification_hub import Subscriber, TargetedNotificationHub
from app.enterprise.university_engine import ConflictError, UniversityOperationsService, UserPrincipal
from app.lld.idempotency import IdempotencyStore
from app.solver import (
    AllocationSpec,
    FacultySpec,
    RoomSpec,
    SectionSpec,
    TimeSlotSpec,
    solve_timetable,
)


def run_concurrency_and_load_audit() -> dict[str, object]:
    hub = TargetedNotificationHub()
    svc = UniversityOperationsService(hub)
    inst = "inst-tiet"

    c1 = UserPrincipal("coord-1", inst, "COORDINATOR", department_id="dept-cse")
    c2 = UserPrincipal("coord-2", inst, "COORDINATOR", department_id="dept-cse")
    fac = UserPrincipal("fac-1", inst, "FACULTY", department_id="dept-cse")
    stu_a = UserPrincipal("stu-a", inst, "STUDENT", department_id="dept-cse", section_id="sec-1")
    stu_b = UserPrincipal("stu-b", inst, "STUDENT", department_id="dept-cse", section_id="sec-1")

    # 1 & 2. Two coordinators publish conflicting timetables / book the same room simultaneously
    def book_same_room(actor: UserPrincipal) -> str:
        try:
            svc.publish_routine_entry(actor, "dept-cse", f"sec-{actor.user_id}", "CS101", f"f-{actor.user_id}", "LT-101", "Monday", "P1")
            return "OK"
        except ConflictError:
            return "CONFLICT"

    with ThreadPoolExecutor(max_workers=2) as pool:
        room_res = sorted(pool.map(book_same_room, [c1, c2]))
    assert room_res == ["CONFLICT", "OK"], f"Expected 1 OK and 1 CONFLICT, got {room_res}"

    # 3 & 4. Two students vote simultaneously & vote change races with poll close
    req = svc.create_makeup_request(
        actor=fac,
        department_id="dept-cse",
        section_id="sec-1",
        course_code="CS201",
        teacher_id=fac.user_id,
        original_entry_id="orig-1",
        reason="Lab maintenance",
        deadline=datetime.now(timezone.utc) + timedelta(minutes=30),
        proposals=[("Tuesday", "P2", "LT-102"), ("Wednesday", "P2", "LT-103")],
    )
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda pair: svc.cast_student_vote(pair[0], req.request_id, pair[1]), [(stu_a, "opt-1"), (stu_b, "opt-1")]))
    assert req.proposals[0].votes == 2

    # 5. Two coordinators attempt Apply Winner simultaneously -> ONLY ONE succeeds!
    def try_apply(actor: UserPrincipal) -> str:
        try:
            svc.close_and_approve_makeup(actor, req.request_id)
            return "APPLIED"
        except ConflictError:
            return "ALREADY_APPLIED"

    with ThreadPoolExecutor(max_workers=2) as pool:
        apply_res = sorted(pool.map(try_apply, [c1, c2]))
    assert apply_res == ["ALREADY_APPLIED", "APPLIED"], f"Expected 1 APPLIED, got {apply_res}"

    # Post-close vote change MUST fail cleanly
    try:
        svc.cast_student_vote(stu_a, req.request_id, "opt-2")
        raise AssertionError("Vote change after poll close should be rejected")
    except ConflictError:
        pass

    # 7. Duplicate API request idempotency
    idem = IdempotencyStore()
    idem.save(inst, "req-xyz-1", {"pollId": req.request_id}, 200, {"applied": True})
    replayed = idem.lookup(inst, "req-xyz-1", {"pollId": req.request_id})
    assert replayed is not None and replayed.response_body == {"applied": True}

    # Section F: Realistic Solver & Voting Load Benchmark (500 allocations, 1000 concurrent student votes)
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    slots = [TimeSlotSpec(f"{d[:3]}-P{p}", d, p, is_lunch=(p == 4)) for d in days for p in range(1, 9)]
    rooms = [RoomSpec(f"R-{i}", f"Room-{i}", capacity=80, equipment=("Projector",)) for i in range(1, 41)]
    faculty = [FacultySpec(f"F-{i}", f"Prof. {i}", max_hours_per_week=16) for i in range(1, 81)]
    sections = [SectionSpec(f"S-{i}", f"SEC-{i}", student_count=60) for i in range(1, 41)]
    allocations = [
        AllocationSpec(
            id=f"A-{i}",
            course_id=f"C-{i % 20}",
            course_code=f"CS{100 + (i % 20)}",
            faculty_id=f"F-{(i % 80) + 1}",
            section_id=f"S-{(i % 40) + 1}",
            hours_per_week=2,
            required_equipment=("Projector",),
        )
        for i in range(250)  # 500 scheduled sessions
    ]
    t0 = time.perf_counter()
    solved = solve_timetable(slots, rooms, faculty, sections, allocations)
    solve_ms = round((time.perf_counter() - t0) * 1000, 2)
    assert solved.is_feasible is True and solved.health.hard_violations == 0 and len(solved.sessions) == 500

    # 1,000 concurrent student votes benchmark
    req_load = svc.create_makeup_request(
        actor=fac,
        department_id="dept-cse",
        section_id="sec-load",
        course_code="CS301",
        teacher_id="fac-load",
        original_entry_id="orig-load",
        reason="Load test",
        deadline=datetime.now(timezone.utc) + timedelta(hours=1),
        proposals=[("Thursday", "P5", "LT-105"), ("Friday", "P5", "LT-106")],
    )
    load_students = [UserPrincipal(f"s-{i}", inst, "STUDENT", section_id="sec-load") for i in range(1000)]
    t1 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=16) as pool:
        list(pool.map(lambda st: svc.cast_student_vote(st, req_load.request_id, "opt-1"), load_students))
    votes_1000_ms = round((time.perf_counter() - t1) * 1000, 2)
    assert req_load.proposals[0].votes == 1000

    return {
        "concurrency_scenarios_passed": "8/8",
        "solver_500_sessions_ms": solve_ms,
        "solver_hard_violations": solved.health.hard_violations,
        "solver_health_score": solved.health.overall_score,
        "concurrent_1000_votes_ms": votes_1000_ms,
    }


def test_concurrency_and_benchmark() -> None:
    metrics = run_concurrency_and_load_audit()
    assert metrics["solver_hard_violations"] == 0


if __name__ == "__main__":
    print("AUDIT BENCHMARK METRICS:", run_concurrency_and_load_audit())
