"""Unit tests for IntelliSchedule v2 solver, validator, health score, freeze window, and recovery engine."""

from datetime import datetime, timedelta, timezone

from app.solver import (
    AllocationSpec,
    FacultySpec,
    RoomSpec,
    SectionSpec,
    TimeSlotSpec,
    evaluate_freeze_window,
    find_recovery_opportunities,
    solve_timetable,
)


def _sample_fixture():
    slots = [
        TimeSlotSpec("mon-1", "Monday", 1),
        TimeSlotSpec("mon-2", "Monday", 2),
        TimeSlotSpec("mon-lunch", "Monday", 3, is_lunch=True),
        TimeSlotSpec("mon-4", "Monday", 4),
        TimeSlotSpec("tue-1", "Tuesday", 1),
        TimeSlotSpec("tue-2", "Tuesday", 2),
    ]
    rooms = [
        RoomSpec("r-101", "LT-101", capacity=80, room_type="LECTURE", equipment=("Projector",)),
        RoomSpec("r-lab", "CLab-1", capacity=40, room_type="LAB", equipment=("Projector", "Workstations")),
    ]
    faculty = [
        FacultySpec("f-1", "Dr. Sharma", max_hours_per_week=14, unavailable_slots=frozenset({"mon-4"})),
        FacultySpec("f-2", "Dr. Verma", max_hours_per_week=16),
    ]
    sections = [
        SectionSpec("s-1", "COE-1", student_count=60),
        SectionSpec("s-2", "COE-2", student_count=35),
    ]
    allocations = [
        AllocationSpec("a-1", "c-1", "CS301", "f-1", "s-1", "LECTURE", hours_per_week=2, required_equipment=("Projector",)),
        AllocationSpec("a-2", "c-2", "CS302L", "f-2", "s-2", "LAB", hours_per_week=1, required_equipment=("Workstations",), requires_lab=True),
    ]
    return slots, rooms, faculty, sections, allocations


def test_solver_produces_zero_hard_violations_and_valid_health_score() -> None:
    slots, rooms, faculty, sections, allocations = _sample_fixture()
    res = solve_timetable(slots, rooms, faculty, sections, allocations)
    assert res.is_feasible is True
    assert res.validation.is_valid is True
    assert res.health.hard_violations == 0
    assert res.health.overall_score > 70.0
    assert len(res.sessions) == 3
    assert all(s.slot_id != "mon-lunch" for s in res.sessions)
    assert all(not (s.faculty_id == "f-1" and s.slot_id == "mon-4") for s in res.sessions)


def test_freeze_window_governance_tiers() -> None:
    now = datetime(2026, 11, 25, 12, 0, tzinfo=timezone.utc)
    assert evaluate_freeze_window(now + timedelta(hours=12), now=now)["window"] == "LOCKED"
    assert evaluate_freeze_window(now + timedelta(hours=48), now=now)["window"] == "APPROVAL_REQUIRED"
    assert evaluate_freeze_window(now + timedelta(days=10), now=now)["window"] == "FLEXIBLE"


def test_recovery_engine_ranks_cross_cancellation_highest() -> None:
    slots, rooms, faculty, sections, allocations = _sample_fixture()
    res = solve_timetable(slots, rooms, faculty, sections, allocations)
    used_slots = {s.slot_id for s in res.sessions}
    free_slot = next(s.id for s in slots if not s.is_lunch and s.id not in used_slots)
    opps = find_recovery_opportunities(
        makeup_task_id="mt-1",
        faculty_id="f-2",
        section_id="s-1",
        cancelled_day="Monday",
        slots=slots,
        rooms=rooms,
        sections=sections,
        active_sessions=res.sessions,
        freed_slot_ids={free_slot},
    )
    assert opps
    assert opps[0].slot_id == free_slot
    assert opps[0].strategy == "CROSS_CANCELLATION"
