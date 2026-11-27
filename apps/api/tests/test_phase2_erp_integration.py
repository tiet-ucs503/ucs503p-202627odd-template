"""Phase 2 Mandatory 12-Step Cross-Module Integration Test + 50,000-Student Import Benchmark."""

from __future__ import annotations

import json
import time
from datetime import date, timedelta

from app.enterprise.notification_hub import Subscriber, TargetedNotificationHub
from app.enterprise.student_importer import StudentImportRow, validate_and_map_student_dataset
from app.enterprise.syllabus_workload import (
    AcademicProgressAndWorkloadService,
    SyllabusTopic,
    TeachingSessionRecord,
)


def run_phase2_verification() -> dict[str, object]:
    hub = TargetedNotificationHub()
    svc = AcademicProgressAndWorkloadService(hub)
    inst = "inst-tiet"

    # Subscribe HOD, affected students, and unrelated department student
    hub.subscribe(Subscriber("dev-hod", "hod-cse", "HOD", inst, department_id="dept-cse"))
    hub.subscribe(Subscriber("dev-stu1", "stu-1", "STUDENT", inst, department_id="dept-cse", section_id="sec-a"))
    hub.subscribe(Subscriber("dev-other", "stu-me", "STUDENT", inst, department_id="dept-me", section_id="sec-me1"))

    # 1. Faculty has scheduled lectures + syllabus topics
    s1 = TeachingSessionRecord("sess-1", "CS301", "fac-1", "sec-a", "dept-cse", "Monday", 1, "LECTURE", "SCHEDULED")
    s2 = TeachingSessionRecord("sess-2", "CS301", "fac-1", "sec-a", "dept-cse", "Wednesday", 2, "LECTURE", "SCHEDULED")
    svc.register_session(s1)
    svc.register_session(s2)
    svc.planned_sessions_by_course["CS301"] = 10
    svc.add_topic(SyllabusTopic("t-1", "u-1", "CS301", "Arrays", weight=2.0))
    svc.add_topic(SyllabusTopic("t-2", "u-1", "CS301", "Linked Lists", weight=3.0, target_date=date.today() - timedelta(days=2)))

    # Complete topic t-1 against valid session s2
    svc.update_topic_progress("fac-1", "t-1", "COMPLETED", session_id="sess-2", notes="Covered arrays & complexity")
    prog_before = svc.calculate_syllabus_progress("CS301")
    assert prog_before["topic_completion_pct"] == 40.0
    assert prog_before["session_completion_pct"] == 10.0
    assert "t-2" in prog_before["delayed_topic_ids"]

    # 2–5. Faculty selects scheduled lecture s1 & requests cancellation -> HOD receives notification
    req = svc.request_class_cancellation(inst, "fac-1", "sess-1", reason="Medical leave")
    assert any(e.event_type == "CANCELLATION_REQUESTED" for e in hub.get_delivered("dev-hod"))

    # 6–12. HOD approves cancellation -> Student & Faculty timetables reflect disruption,
    #        workload updates, syllabus does NOT increase, audit contains full chain, affected students notified!
    svc.approve_class_cancellation(inst, "hod-cse", req.request_id)
    assert svc.sessions["sess-1"].status == "CANCELLED"
    assert any(e.event_type == "CLASS_CANCELLED" for e in hub.get_delivered("dev-stu1"))
    assert not any(e.event_type == "CLASS_CANCELLED" for e in hub.get_delivered("dev-other"))

    # Cancelled session MUST NOT be usable to mark syllabus completed
    try:
        svc.update_topic_progress("fac-1", "t-2", "COMPLETED", session_id="sess-1")
        raise AssertionError("Cancelled session must not complete a syllabus topic")
    except ValueError:
        pass

    prog_after = svc.calculate_syllabus_progress("CS301")
    assert prog_after["topic_completion_pct"] == 40.0
    assert prog_after["session_completion_pct"] == 10.0
    assert prog_after["cancelled_sessions"] == 1

    wl = svc.calculate_faculty_workload("fac-1", "Assistant Professor")
    assert wl.completed_sessions == 1 and wl.cancelled_sessions == 1 and wl.scheduled_hours == 1
    assert any(a["action"] == "CANCELLATION_REQUESTED" for a in svc.audit_log)
    assert any(a["action"] == "CANCELLATION_APPROVED" for a in svc.audit_log)

    # 50,000-Student Bulk Import & Automatic Group-to-Timetable Mapping Benchmark
    depts = {"CSE", "ECE", "ME", "EE", "CE"}
    dept_list = sorted(depts)
    sec_map = {(d, sem, f"SEC-{s}"): f"tt-{d}-s{sem}-sec{s}" for d in dept_list for sem in (1, 3, 5, 7) for s in range(1, 11)}
    rows = [
        StudentImportRow(
            enrollment_number=f"1026{i:05d}",
            email=f"student{i}@thapar.edu",
            full_name=f"Student {i}",
            department_code=dept_list[i % 5],
            program_code=f"BTECH-{dept_list[i % 5]}",
            semester=(1, 3, 5, 7)[(i // 5) % 4],
            section_name=f"SEC-{((i // 20) % 10) + 1}",
            group_code=f"G{((i // 200) % 2) + 1}",
        )
        for i in range(50_000)
    ]
    # Inject 1 duplicate + 1 invalid department row to verify exception handling
    rows.append(rows[0])
    rows.append(StudentImportRow("999999999", "bad@thapar.edu", "Bad Dept", "UNKNOWN", "BTECH", 3, "SEC-1", "G1"))

    t0 = time.perf_counter()
    mapped, report = validate_and_map_student_dataset(rows, depts, sec_map, batch_size=2500)
    import_ms = round((time.perf_counter() - t0) * 1000, 2)
    assert report.valid_rows == 50_000
    assert report.duplicate_rows == 1
    assert report.invalid_rows == 1
    assert report.mapped_timetables == 200

    return {
        "mandatory_12_step_integration": "PASS",
        "students_imported_and_mapped": report.valid_rows,
        "duplicates_caught": report.duplicate_rows,
        "invalid_rows_caught": report.invalid_rows,
        "import_50k_ms": import_ms,
    }


def test_phase2_integration() -> None:
    res = run_phase2_verification()
    assert res["mandatory_12_step_integration"] == "PASS"


if __name__ == "__main__":
    print(json.dumps(run_phase2_verification(), indent=2))
