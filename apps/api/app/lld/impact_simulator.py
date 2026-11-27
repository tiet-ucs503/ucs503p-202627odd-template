"""Impact Analysis Graph & What-If Simulator (IntelliSchedule Architecture v2 Section 9)."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.solver import (
    AllocationSpec,
    FacultySpec,
    RoomSpec,
    ScheduledSession,
    SectionSpec,
    TimeSlotSpec,
    calculate_timetable_health_score,
    solve_timetable,
    validate_solution,
)


@dataclass(frozen=True)
class ImpactReport:
    event_type: str
    target_id: str
    affected_sessions: list[str]
    affected_faculty: list[str]
    affected_sections: list[str]
    affected_rooms: list[str]
    severity: str  # LOW | MEDIUM | HIGH | CRITICAL
    recommended_strategy: str


@dataclass(frozen=True)
class WhatIfComparison:
    baseline_health: float
    candidate_health: float
    health_delta: float
    sessions_changed: int
    stability_score: float
    is_feasible: bool
    hard_violations: int
    changed_session_ids: list[str] = field(default_factory=list)


def analyze_disruption_impact(
    event_type: str,
    target_id: str,
    active_sessions: list[ScheduledSession],
    affected_slot_ids: set[str] | None = None,
) -> ImpactReport:
    slot_filter = affected_slot_ids or set()
    impacted: list[ScheduledSession] = []
    for s in active_sessions:
        slot_matches = not slot_filter or s.slot_id in slot_filter
        if not slot_matches:
            continue
        if event_type == "FACULTY_ABSENT" and s.faculty_id == target_id:
            impacted.append(s)
        elif event_type == "ROOM_UNAVAILABLE" and s.room_id == target_id:
            impacted.append(s)
        elif event_type == "CLASS_CANCELLED" and s.session_id == target_id:
            impacted.append(s)

    count = len(impacted)
    if count == 0:
        severity = "LOW"
        strategy = "NO_ACTION_REQUIRED"
    elif count == 1:
        severity = "MEDIUM"
        strategy = "SAME_DAY_OR_CROSS_CANCELLATION_RECOVERY"
    elif count <= 4:
        severity = "HIGH"
        strategy = "INCREMENTAL_ROOM_OR_SLOT_REPAIR"
    else:
        severity = "CRITICAL"
        strategy = "PARTIAL_REOPTIMIZATION_WITH_COORDINATOR_APPROVAL"

    return ImpactReport(
        event_type=event_type,
        target_id=target_id,
        affected_sessions=sorted(s.session_id for s in impacted),
        affected_faculty=sorted({s.faculty_id for s in impacted}),
        affected_sections=sorted({s.section_id for s in impacted}),
        affected_rooms=sorted({s.room_id for s in impacted}),
        severity=severity,
        recommended_strategy=strategy,
    )


def run_what_if_simulation(
    baseline_sessions: list[ScheduledSession],
    slots: list[TimeSlotSpec],
    rooms: list[RoomSpec],
    faculty: list[FacultySpec],
    sections: list[SectionSpec],
    allocations: list[AllocationSpec],
    unavailable_room_ids: set[str] | None = None,
    unavailable_faculty_slots: dict[str, set[str]] | None = None,
) -> WhatIfComparison:
    base_val = validate_solution(baseline_sessions, slots, rooms, faculty, sections, allocations)
    base_health = calculate_timetable_health_score(baseline_sessions, slots, rooms, faculty, sections, base_val)

    disabled_rooms = unavailable_room_ids or set()
    extra_unavail = unavailable_faculty_slots or {}

    sim_rooms = [
        RoomSpec(r.id, r.name, r.capacity, r.room_type, r.building, r.equipment, r.is_available and r.id not in disabled_rooms)
        for r in rooms
    ]
    sim_faculty = [
        FacultySpec(
            f.id,
            f.name,
            f.max_hours_per_week,
            f.unavailable_slots | frozenset(extra_unavail.get(f.id, set())),
            f.preferred_slots,
        )
        for f in faculty
    ]

    # Preserve unaffected sessions as locked to maximize schedule stability
    unaffected_locked = [
        s
        for s in baseline_sessions
        if s.room_id not in disabled_rooms and s.slot_id not in extra_unavail.get(s.faculty_id, set())
    ]

    sim_result = solve_timetable(
        slots=slots,
        rooms=sim_rooms,
        faculty=sim_faculty,
        sections=sections,
        allocations=allocations,
        locked_sessions=unaffected_locked,
    )
    cand_health = calculate_timetable_health_score(
        sim_result.sessions,
        slots,
        sim_rooms,
        sim_faculty,
        sections,
        sim_result.validation,
        previous_sessions=baseline_sessions,
    )

    base_map = {s.session_id: (s.slot_id, s.room_id) for s in baseline_sessions}
    cand_map = {s.session_id: (s.slot_id, s.room_id) for s in sim_result.sessions}
    changed = sorted(sid for sid in set(base_map) | set(cand_map) if base_map.get(sid) != cand_map.get(sid))

    return WhatIfComparison(
        baseline_health=base_health.overall_score,
        candidate_health=cand_health.overall_score,
        health_delta=round(cand_health.overall_score - base_health.overall_score, 2),
        sessions_changed=len(changed),
        stability_score=cand_health.stability_score,
        is_feasible=sim_result.is_feasible,
        hard_violations=cand_health.hard_violations,
        changed_session_ids=changed,
    )
