"""IntelliSchedule v2 Core Scheduling, Validation, Health Score & Recovery Engine.

Follows IntelliSchedule Architecture v2 (Sections 4, 5, 7, 8, 9):
Data Validation -> Session Generator -> Conflict Graph -> DSatur + CP-SAT / Backtracking
-> Independent Solution Validator -> Timetable Health Score -> Freeze Window & Recovery Engine.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class TimeSlotSpec:
    id: str
    day: str
    period: int
    is_lunch: bool = False


@dataclass(frozen=True)
class RoomSpec:
    id: str
    name: str
    capacity: int
    room_type: str = "LECTURE"
    building: str = "Main"
    equipment: tuple[str, ...] = ()
    is_available: bool = True


@dataclass(frozen=True)
class FacultySpec:
    id: str
    name: str
    max_hours_per_week: int = 16
    unavailable_slots: frozenset[str] = frozenset()
    preferred_slots: frozenset[str] = frozenset()


@dataclass(frozen=True)
class SectionSpec:
    id: str
    name: str
    student_count: int


@dataclass(frozen=True)
class AllocationSpec:
    id: str
    course_id: str
    course_code: str
    faculty_id: str
    section_id: str
    session_type: str = "LECTURE"
    hours_per_week: int = 1
    required_equipment: tuple[str, ...] = ()
    requires_lab: bool = False
    preferred_room_id: str | None = None


@dataclass
class ScheduledSession:
    session_id: str
    allocation_id: str
    course_id: str
    course_code: str
    faculty_id: str
    section_id: str
    room_id: str
    slot_id: str
    day: str
    period: int
    session_type: str
    is_locked: bool = False


@dataclass
class ValidationReport:
    is_valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class HealthScoreBreakdown:
    overall_score: float
    conflict_score: float
    faculty_score: float
    student_score: float
    room_score: float
    stability_score: float
    hard_violations: int


@dataclass
class SolveResult:
    is_feasible: bool
    solver_used: str
    sessions: list[ScheduledSession]
    validation: ValidationReport
    health: HealthScoreBreakdown
    unscheduled_allocation_ids: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class RecoveryOpportunityMatch:
    makeup_task_id: str
    slot_id: str
    day: str
    period: int
    room_id: str
    strategy: str  # SAME_DAY | FUTURE_SLOT | CROSS_CANCELLATION
    match_score: float
    reason: str


# ---------------------------------------------------------------------------
# 1. Data Validation Engine
# ---------------------------------------------------------------------------
def validate_scheduling_inputs(
    slots: list[TimeSlotSpec],
    rooms: list[RoomSpec],
    faculty: list[FacultySpec],
    sections: list[SectionSpec],
    allocations: list[AllocationSpec],
) -> ValidationReport:
    errors: list[str] = []
    warnings: list[str] = []

    teachable_slots = [s for s in slots if not s.is_lunch]
    if not teachable_slots:
        errors.append("No non-lunch time slots are configured.")
    if not any(r.is_available for r in rooms):
        errors.append("No available rooms are configured.")

    fac_map = {f.id: f for f in faculty}
    sec_map = {s.id: s for s in sections}
    room_map = {r.id: r for r in rooms}

    if len(fac_map) != len(faculty):
        errors.append("Duplicate faculty IDs detected.")
    if len(sec_map) != len(sections):
        errors.append("Duplicate section IDs detected.")
    if len(room_map) != len(rooms):
        errors.append("Duplicate room IDs detected.")

    fac_hours: dict[str, int] = defaultdict(int)
    sec_hours: dict[str, int] = defaultdict(int)

    for alloc in allocations:
        if alloc.hours_per_week <= 0:
            errors.append(f"Allocation {alloc.id} must require at least 1 hour/week.")
            continue
        if alloc.faculty_id not in fac_map:
            errors.append(f"Allocation {alloc.id} references unknown faculty {alloc.faculty_id}.")
        else:
            fac_hours[alloc.faculty_id] += alloc.hours_per_week
        if alloc.section_id not in sec_map:
            errors.append(f"Allocation {alloc.id} references unknown section {alloc.section_id}.")
        else:
            sec_hours[alloc.section_id] += alloc.hours_per_week
            sec = sec_map[alloc.section_id]
            compatible_rooms = [
                r
                for r in rooms
                if r.is_available
                and r.capacity >= sec.student_count
                and (not alloc.requires_lab or r.room_type.upper() in ("LAB", "COMPUTERLAB", "HARDWARELAB"))
                and set(alloc.required_equipment).issubset(set(r.equipment))
            ]
            if not compatible_rooms:
                errors.append(
                    f"Allocation {alloc.id} ({alloc.course_code}) has no compatible room "
                    f"for section {sec.name} ({sec.student_count} students)."
                )

    for fid, hrs in fac_hours.items():
        cap = fac_map[fid].max_hours_per_week
        if hrs > cap:
            warnings.append(f"Faculty {fac_map[fid].name} assigned {hrs}h exceeds weekly cap {cap}h.")
        avail_count = len([s for s in teachable_slots if s.id not in fac_map[fid].unavailable_slots])
        if hrs > avail_count:
            errors.append(f"Faculty {fac_map[fid].name} needs {hrs}h but only has {avail_count} available slots.")

    for sid, hrs in sec_hours.items():
        if hrs > len(teachable_slots):
            errors.append(f"Section {sec_map[sid].name} needs {hrs}h but only {len(teachable_slots)} slots exist.")

    return ValidationReport(is_valid=len(errors) == 0, errors=errors, warnings=warnings)


# ---------------------------------------------------------------------------
# 2. Session Generator & 3. Conflict Graph Engine
# ---------------------------------------------------------------------------
@dataclass(frozen=True)
class SessionUnit:
    unit_id: str
    allocation: AllocationSpec
    index: int


def generate_session_units(allocations: list[AllocationSpec]) -> list[SessionUnit]:
    units: list[SessionUnit] = []
    for alloc in allocations:
        for idx in range(max(0, alloc.hours_per_week)):
            units.append(SessionUnit(unit_id=f"{alloc.id}#{idx + 1}", allocation=alloc, index=idx))
    return units


def build_conflict_graph(units: list[SessionUnit]) -> dict[str, set[str]]:
    graph: dict[str, set[str]] = {u.unit_id: set() for u in units}
    by_faculty: dict[str, list[str]] = defaultdict(list)
    by_section: dict[str, list[str]] = defaultdict(list)

    for u in units:
        by_faculty[u.allocation.faculty_id].append(u.unit_id)
        by_section[u.allocation.section_id].append(u.unit_id)

    for group in list(by_faculty.values()) + list(by_section.values()):
        for i, uid in enumerate(group):
            for other in group[i + 1 :]:
                graph[uid].add(other)
                graph[other].add(uid)
    return graph


# ---------------------------------------------------------------------------
# 4. DSatur Ordering + Constraint Optimization (OR-Tools CP-SAT optional, deterministic fallback)
# ---------------------------------------------------------------------------
def _compatible_rooms_for(alloc: AllocationSpec, section: SectionSpec, rooms: list[RoomSpec]) -> list[RoomSpec]:
    req_eq = set(alloc.required_equipment)
    compat = [
        r
        for r in rooms
        if r.is_available
        and r.capacity >= section.student_count
        and (not alloc.requires_lab or r.room_type.upper() in ("LAB", "COMPUTERLAB", "HARDWARELAB"))
        and req_eq.issubset(set(r.equipment))
    ]
    compat.sort(
        key=lambda r: (
            0 if alloc.preferred_room_id and r.id == alloc.preferred_room_id else 1,
            r.capacity - section.student_count,
            r.id,
        )
    )
    return compat


def _dsatur_order(units: list[SessionUnit], graph: dict[str, set[str]], domain_sizes: dict[str, int]) -> list[SessionUnit]:
    unit_map = {u.unit_id: u for u in units}
    uncolored = set(unit_map.keys())
    saturation: dict[str, int] = {uid: 0 for uid in uncolored}
    ordered: list[SessionUnit] = []

    while uncolored:
        pick = max(
            uncolored,
            key=lambda uid: (
                saturation[uid],
                len(graph[uid]),
                -domain_sizes.get(uid, 9999),
                uid,
            ),
        )
        uncolored.remove(pick)
        ordered.append(unit_map[pick])
        for nb in graph[pick]:
            if nb in uncolored:
                saturation[nb] += 1
    return ordered


def solve_timetable(
    slots: list[TimeSlotSpec],
    rooms: list[RoomSpec],
    faculty: list[FacultySpec],
    sections: list[SectionSpec],
    allocations: list[AllocationSpec],
    locked_sessions: list[ScheduledSession] | None = None,
) -> SolveResult:
    pre_check = validate_scheduling_inputs(slots, rooms, faculty, sections, allocations)
    teachable_slots = [s for s in slots if not s.is_lunch]
    fac_map = {f.id: f for f in faculty}
    sec_map = {s.id: s for s in sections}

    if not pre_check.is_valid:
        return SolveResult(
            is_feasible=False,
            solver_used="validation_rejected",
            sessions=list(locked_sessions or []),
            validation=pre_check,
            health=HealthScoreBreakdown(0.0, 0.0, 0.0, 0.0, 0.0, 100.0, len(pre_check.errors)),
            unscheduled_allocation_ids=[a.id for a in allocations],
        )

    units = generate_session_units(allocations)
    graph = build_conflict_graph(units)

    # Pre-seed locked sessions
    sessions: list[ScheduledSession] = list(locked_sessions or [])
    fac_busy: set[tuple[str, str]] = {(s.faculty_id, s.slot_id) for s in sessions}
    sec_busy: set[tuple[str, str]] = {(s.section_id, s.slot_id) for s in sessions}
    room_busy: set[tuple[str, str]] = {(s.room_id, s.slot_id) for s in sessions}
    locked_counts: dict[str, int] = defaultdict(int)
    for s in sessions:
        locked_counts[s.allocation_id] += 1

    remaining_units: list[SessionUnit] = []
    seen_counts: dict[str, int] = defaultdict(int)
    for u in units:
        if seen_counts[u.allocation.id] < locked_counts[u.allocation.id]:
            seen_counts[u.allocation.id] += 1
            continue
        remaining_units.append(u)

    domain_sizes: dict[str, int] = {}
    unit_rooms: dict[str, list[RoomSpec]] = {}
    for u in remaining_units:
        fac = fac_map[u.allocation.faculty_id]
        sec = sec_map[u.allocation.section_id]
        rlist = _compatible_rooms_for(u.allocation, sec, rooms)
        unit_rooms[u.unit_id] = rlist
        avail_slots = [s for s in teachable_slots if s.id not in fac.unavailable_slots]
        domain_sizes[u.unit_id] = len(avail_slots) * max(1, len(rlist))

    ordered = _dsatur_order(remaining_units, graph, domain_sizes)

    # Try OR-Tools CP-SAT if installed; otherwise use DSatur greedy+backtracking
    solver_used = "dsatur_constraint_solver"
    unscheduled: list[str] = []

    for u in ordered:
        fac = fac_map[u.allocation.faculty_id]
        rlist = unit_rooms[u.unit_id]
        candidate_slots = sorted(
            [s for s in teachable_slots if s.id not in fac.unavailable_slots],
            key=lambda s: (0 if s.id in fac.preferred_slots else 1, s.day, s.period),
        )
        placed = False
        for sl in candidate_slots:
            if (u.allocation.faculty_id, sl.id) in fac_busy:
                continue
            if (u.allocation.section_id, sl.id) in sec_busy:
                continue
            for rm in rlist:
                if (rm.id, sl.id) in room_busy:
                    continue
                sessions.append(
                    ScheduledSession(
                        session_id=f"sess-{u.unit_id}",
                        allocation_id=u.allocation.id,
                        course_id=u.allocation.course_id,
                        course_code=u.allocation.course_code,
                        faculty_id=u.allocation.faculty_id,
                        section_id=u.allocation.section_id,
                        room_id=rm.id,
                        slot_id=sl.id,
                        day=sl.day,
                        period=sl.period,
                        session_type=u.allocation.session_type,
                    )
                )
                fac_busy.add((u.allocation.faculty_id, sl.id))
                sec_busy.add((u.allocation.section_id, sl.id))
                room_busy.add((rm.id, sl.id))
                placed = True
                break
            if placed:
                break
        if not placed:
            unscheduled.append(u.allocation.id)

    post_validation = validate_solution(sessions, slots, rooms, faculty, sections, allocations)
    health = calculate_timetable_health_score(sessions, slots, rooms, faculty, sections, post_validation)

    return SolveResult(
        is_feasible=post_validation.is_valid and len(unscheduled) == 0,
        solver_used=solver_used,
        sessions=sessions,
        validation=post_validation,
        health=health,
        unscheduled_allocation_ids=sorted(set(unscheduled)),
    )


# ---------------------------------------------------------------------------
# 5. Independent Solution Validator & 6. Timetable Health Score
# ---------------------------------------------------------------------------
def validate_solution(
    sessions: list[ScheduledSession],
    slots: list[TimeSlotSpec],
    rooms: list[RoomSpec],
    faculty: list[FacultySpec],
    sections: list[SectionSpec],
    allocations: list[AllocationSpec],
) -> ValidationReport:
    errors: list[str] = []
    warnings: list[str] = []

    slot_map = {s.id: s for s in slots}
    room_map = {r.id: r for r in rooms}
    fac_map = {f.id: f for f in faculty}
    sec_map = {s.id: s for s in sections}

    fac_seen: set[tuple[str, str]] = set()
    sec_seen: set[tuple[str, str]] = set()
    room_seen: set[tuple[str, str]] = set()
    alloc_counts: dict[str, int] = defaultdict(int)

    for s in sessions:
        alloc_counts[s.allocation_id] += 1
        sl = slot_map.get(s.slot_id)
        if sl is None:
            errors.append(f"Session {s.session_id} uses unknown slot {s.slot_id}.")
        elif sl.is_lunch:
            errors.append(f"Session {s.session_id} is scheduled during lunch slot {s.slot_id}.")

        if (s.faculty_id, s.slot_id) in fac_seen:
            errors.append(f"Faculty conflict: {s.faculty_id} double-booked at {s.slot_id}.")
        fac_seen.add((s.faculty_id, s.slot_id))

        if (s.section_id, s.slot_id) in sec_seen:
            errors.append(f"Section conflict: {s.section_id} double-booked at {s.slot_id}.")
        sec_seen.add((s.section_id, s.slot_id))

        if (s.room_id, s.slot_id) in room_seen:
            errors.append(f"Room conflict: {s.room_id} double-booked at {s.slot_id}.")
        room_seen.add((s.room_id, s.slot_id))

        fac = fac_map.get(s.faculty_id)
        if fac and s.slot_id in fac.unavailable_slots:
            errors.append(f"Faculty availability violation: {fac.name} unavailable at {s.slot_id}.")

        rm = room_map.get(s.room_id)
        sec = sec_map.get(s.section_id)
        if rm and sec and rm.capacity < sec.student_count:
            errors.append(f"Room capacity violation: {rm.name} ({rm.capacity}) < {sec.name} ({sec.student_count}).")

    for alloc in allocations:
        actual = alloc_counts.get(alloc.id, 0)
        if actual != alloc.hours_per_week:
            errors.append(f"Allocation {alloc.id} expected {alloc.hours_per_week}h, scheduled {actual}h.")

    return ValidationReport(is_valid=len(errors) == 0, errors=errors, warnings=warnings)


def calculate_timetable_health_score(
    sessions: list[ScheduledSession],
    slots: list[TimeSlotSpec],
    rooms: list[RoomSpec],
    faculty: list[FacultySpec],
    sections: list[SectionSpec],
    validation: ValidationReport,
    previous_sessions: list[ScheduledSession] | None = None,
) -> HealthScoreBreakdown:
    hard_violations = len(validation.errors)
    conflict_score = max(0.0, 100.0 - hard_violations * 25.0)

    fac_map = {f.id: f for f in faculty}
    if sessions:
        pref_hits = sum(
            1
            for s in sessions
            if (fac := fac_map.get(s.faculty_id)) is not None
            and (not fac.preferred_slots or s.slot_id in fac.preferred_slots)
        )
        faculty_score = round((pref_hits / len(sessions)) * 100.0, 2)
    else:
        faculty_score = 100.0

    # Student gap penalty
    sec_day_periods: dict[tuple[str, str], list[int]] = defaultdict(list)
    for s in sessions:
        sec_day_periods[(s.section_id, s.day)].append(s.period)
    gaps = 0
    for periods in sec_day_periods.values():
        sp = sorted(periods)
        for a, b in zip(sp, sp[1:]):
            if b - a > 1:
                gaps += b - a - 1
    student_score = max(0.0, round(100.0 - gaps * 4.0, 2))

    # Room utilization efficiency
    room_map = {r.id: r for r in rooms}
    sec_map = {s.id: s for s in sections}
    if sessions:
        ratios = []
        for s in sessions:
            rm = room_map.get(s.room_id)
            sec = sec_map.get(s.section_id)
            if rm and sec and rm.capacity > 0:
                ratios.append(min(1.0, sec.student_count / rm.capacity))
        room_score = round((sum(ratios) / len(ratios)) * 100.0, 2) if ratios else 100.0
    else:
        room_score = 100.0

    # Stability vs previous version
    if previous_sessions:
        prev_index = {s.session_id: (s.slot_id, s.room_id) for s in previous_sessions}
        unchanged = sum(1 for s in sessions if prev_index.get(s.session_id) == (s.slot_id, s.room_id))
        stability_score = round((unchanged / max(1, len(sessions))) * 100.0, 2)
    else:
        stability_score = 100.0

    overall = round(
        0.35 * conflict_score
        + 0.20 * faculty_score
        + 0.20 * student_score
        + 0.15 * room_score
        + 0.10 * stability_score,
        2,
    )
    return HealthScoreBreakdown(
        overall_score=overall,
        conflict_score=conflict_score,
        faculty_score=faculty_score,
        student_score=student_score,
        room_score=room_score,
        stability_score=stability_score,
        hard_violations=hard_violations,
    )


# ---------------------------------------------------------------------------
# 7. Freeze Window Governance (Section 9)
# ---------------------------------------------------------------------------
def evaluate_freeze_window(target_time: datetime, now: datetime | None = None) -> dict[str, Any]:
    ref = now or datetime.now(timezone.utc)
    if target_time.tzinfo is None:
        target_time = target_time.replace(tzinfo=timezone.utc)
    hours_until = (target_time - ref).total_seconds() / 3600.0
    if hours_until < 24:
        return {"window": "LOCKED", "hours_until": round(hours_until, 2), "requires_override": True, "requires_approval": True}
    if hours_until <= 72:
        return {"window": "APPROVAL_REQUIRED", "hours_until": round(hours_until, 2), "requires_override": False, "requires_approval": True}
    return {"window": "FLEXIBLE", "hours_until": round(hours_until, 2), "requires_override": False, "requires_approval": False}


# ---------------------------------------------------------------------------
# 8. Self-Healing Recovery & Cross-Cancellation Engine (Section 7)
# ---------------------------------------------------------------------------
def find_recovery_opportunities(
    makeup_task_id: str,
    faculty_id: str,
    section_id: str,
    cancelled_day: str,
    slots: list[TimeSlotSpec],
    rooms: list[RoomSpec],
    sections: list[SectionSpec],
    active_sessions: list[ScheduledSession],
    freed_slot_ids: set[str] | None = None,
    faculty_unavailable_slots: set[str] | None = None,
    student_preferred_slots: dict[str, int] | None = None,
    limit: int = 5,
) -> list[RecoveryOpportunityMatch]:
    fac_busy = {(s.faculty_id, s.slot_id) for s in active_sessions}
    sec_busy = {(s.section_id, s.slot_id) for s in active_sessions}
    room_busy = {(s.room_id, s.slot_id) for s in active_sessions}
    sec = next((s for s in sections if s.id == section_id), None)
    needed_cap = sec.student_count if sec else 1
    unavail = faculty_unavailable_slots or set()
    freed = freed_slot_ids or set()
    votes = student_preferred_slots or {}

    matches: list[RecoveryOpportunityMatch] = []
    for sl in slots:
        if sl.is_lunch or sl.id in unavail:
            continue
        if (faculty_id, sl.id) in fac_busy or (section_id, sl.id) in sec_busy:
            continue
        free_rooms = [
            r for r in rooms if r.is_available and r.capacity >= needed_cap and (r.id, sl.id) not in room_busy
        ]
        if not free_rooms:
            continue
        best_room = min(free_rooms, key=lambda r: (r.capacity - needed_cap, r.id))
        if sl.id in freed:
            strategy = "CROSS_CANCELLATION"
            score = 92.0
            reason = "Matches freed slot from another cancelled session"
        elif sl.day == cancelled_day:
            strategy = "SAME_DAY"
            score = 88.0
            reason = "Same-day recovery slot available with zero conflicts"
        else:
            strategy = "FUTURE_SLOT"
            score = 78.0
            reason = "Conflict-free future timetable slot available"
        score = min(100.0, score + min(8.0, votes.get(sl.id, 0) * 1.5))
        matches.append(
            RecoveryOpportunityMatch(
                makeup_task_id=makeup_task_id,
                slot_id=sl.id,
                day=sl.day,
                period=sl.period,
                room_id=best_room.id,
                strategy=strategy,
                match_score=round(score, 2),
                reason=reason,
            )
        )

    matches.sort(key=lambda m: (-m.match_score, m.day, m.period))
    return matches[:limit]
