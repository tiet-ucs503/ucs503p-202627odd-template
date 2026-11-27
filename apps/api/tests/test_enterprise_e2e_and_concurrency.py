"""Automated 10-Scenario Enterprise E2E, Concurrency, Security & Load Verification Suite."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from app.enterprise.notification_hub import Subscriber, TargetedNotificationHub
from app.enterprise.university_engine import (
    AccessDeniedError,
    ConflictError,
    InvoiceRecord,
    UniversityOperationsService,
    UserPrincipal,
)


def run_all_enterprise_tests() -> dict[str, object]:
    hub = TargetedNotificationHub()
    svc = UniversityOperationsService(hub)

    inst = "inst-tiet"
    coord1 = UserPrincipal("coord-1", inst, "COORDINATOR", department_id="dept-cse")
    coord2 = UserPrincipal("coord-2", inst, "COORDINATOR", department_id="dept-cse")
    teacher = UserPrincipal("fac-1", inst, "FACULTY", department_id="dept-cse")
    stu1 = UserPrincipal("stu-1", inst, "STUDENT", department_id="dept-cse", section_id="sec-coe1")
    stu2 = UserPrincipal("stu-2", inst, "STUDENT", department_id="dept-cse", section_id="sec-coe1")
    stu_other = UserPrincipal("stu-ece", inst, "STUDENT", department_id="dept-ece", section_id="sec-ece1")

    sub_coord = Subscriber("dev-coord", coord1.user_id, coord1.role, inst, department_id="dept-cse")
    sub_stu1 = Subscriber("dev-stu1", stu1.user_id, stu1.role, inst, department_id="dept-cse", section_id="sec-coe1")
    sub_stu2 = Subscriber("dev-stu2", stu2.user_id, stu2.role, inst, department_id="dept-cse", section_id="sec-coe1")
    sub_other = Subscriber("dev-other", stu_other.user_id, stu_other.role, inst, department_id="dept-ece", section_id="sec-ece1")
    for s in (sub_coord, sub_stu1, sub_stu2, sub_other):
        hub.subscribe(s)

    # TEST 1: Coordinator publishes routine -> Student receives without refreshing (and other section does NOT)
    entry1, att1 = svc.publish_routine_entry(coord1, "dept-cse", "sec-coe1", "CS301", teacher.user_id, "LT-101", "Monday", "P1")
    assert any(e.event_type == "TIMETABLE_PUBLISHED" for e in hub.get_delivered("dev-stu1"))
    assert not any(e.event_type == "TIMETABLE_PUBLISHED" for e in hub.get_delivered("dev-other"))

    # TEST 2: Timetable update creates new version & notifies affected students
    entry2, _ = svc.publish_routine_entry(coord1, "dept-cse", "sec-coe1", "CS302", teacher.user_id, "LT-102", "Monday", "P2")
    assert entry2.version_number == 2
    assert len([e for e in hub.get_delivered("dev-stu1") if e.event_type == "TIMETABLE_PUBLISHED"]) == 2

    # TEST 3: Teacher creates makeup request -> Eligible students receive voting notification
    req = svc.create_makeup_request(
        actor=teacher,
        department_id="dept-cse",
        section_id="sec-coe1",
        course_code="CS301",
        teacher_id=teacher.user_id,
        original_entry_id=entry1.entry_id,
        reason="Faculty conference",
        deadline=datetime.now(timezone.utc) + timedelta(hours=2),
        proposals=[("Monday", "P1", "LT-101"), ("Tuesday", "P3", "LT-105")],  # opt-1 conflicts, opt-2 is free!
    )
    assert any(e.event_type == "MAKEUP_POLL_CREATED" for e in hub.get_delivered("dev-stu1"))
    assert not any(e.event_type == "MAKEUP_POLL_CREATED" for e in hub.get_delivered("dev-other"))

    # TEST 4: Multiple students vote simultaneously (200 concurrent student votes!)
    voters = [UserPrincipal(f"stu-load-{i}", inst, "STUDENT", department_id="dept-cse", section_id="sec-coe1") for i in range(200)]
    t0 = time.perf_counter()
    with ThreadPoolExecutor(max_workers=16) as pool:
        list(pool.map(lambda v: svc.cast_student_vote(v, req.request_id, "opt-1" if int(v.user_id.split("-")[-1]) < 120 else "opt-2"), voters))
    vote_ms = round((time.perf_counter() - t0) * 1000, 2)
    assert sum(p.votes for p in req.proposals) == 200
    assert req.proposals[0].votes == 120 and req.proposals[1].votes == 80

    # TEST 5 & 6: Voting closes -> Coordinator approves -> Conflicting opt-1 skipped, conflict-free opt-2 scheduled + Attendance created!
    mk_entry, mk_att = svc.close_and_approve_makeup(coord1, req.request_id)
    assert req.status == "APPROVED" and req.approved_option_id == "opt-2"
    assert mk_entry.day == "Tuesday" and mk_entry.slot_id == "P3" and mk_entry.is_makeup is True
    assert mk_att.is_makeup is True and mk_att.makeup_request_id == req.request_id

    # TEST 7: Two coordinators attempt conflicting room allocation simultaneously -> ONLY ONE succeeds
    results: list[str] = []
    def try_book(c: UserPrincipal) -> str:
        try:
            svc.publish_routine_entry(c, "dept-cse", f"sec-{c.user_id}", "CS401", f"fac-{c.user_id}", "LT-201", "Wednesday", "P4")
            return "OK"
        except ConflictError:
            return "CONFLICT"

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(try_book, [coord1, coord2]))
    assert sorted(results) == ["CONFLICT", "OK"]

    # TEST 8: Disconnected student reconnects -> Replays missed authorized events via Last-Event-ID
    last_seen = hub.get_delivered("dev-stu1")[0].seq_id
    hub.unsubscribe("dev-stu1")
    svc.publish_routine_entry(coord1, "dept-cse", "sec-coe1", "CS305", "fac-99", "LT-109", "Thursday", "P1")
    missed = hub.replay_since(sub_stu1, last_seen)
    assert any("CS305" in ev.title for ev in missed)

    # TEST 9: Cross-department access denied
    try:
        svc.get_department_entries(stu_other, "dept-cse")
        raise AssertionError("Expected AccessDeniedError")
    except AccessDeniedError:
        pass

    # TEST 10: Duplicate event delivery, duplicate attendance, and duplicate payment callbacks suppressed
    dup = hub.publish(f"pub:{entry1.entry_id}:v1", "TIMETABLE_PUBLISHED", inst, "Dup", "Dup", "SECTION", "sec-coe1")
    assert dup is None
    pct1 = svc.mark_attendance(teacher, mk_att.attendance_session_id, stu1.user_id, "PRESENT")
    pct2 = svc.mark_attendance(teacher, mk_att.attendance_session_id, stu1.user_id, "PRESENT")
    assert pct1 == 100.0 and pct2 == 100.0

    svc.invoices["inv-1"] = InvoiceRecord("inv-1", inst, stu1.user_id, amount_due=50_000)
    svc.process_payment_callback("inv-1", "pay-idem-001", 50_000)
    inv_after_dup = svc.process_payment_callback("inv-1", "pay-idem-001", 50_000)
    assert inv_after_dup.amount_paid == 50_000 and inv_after_dup.status == "PAID"

    return {"tests_passed": 10, "concurrent_200_votes_ms": vote_ms, "published_versions": svc.published_version}


def test_all_10_enterprise_scenarios() -> None:
    metrics = run_all_enterprise_tests()
    assert metrics["tests_passed"] == 10


if __name__ == "__main__":
    print("ENTERPRISE TEST METRICS:", run_all_enterprise_tests())
