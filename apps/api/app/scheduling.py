"""Scheduling Management & Self-Healing Recovery API (IntelliSchedule v2 Sections 3, 4, 7, 9)."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal, require_roles
from app.database import get_session
from app.models import AuditLog, EventOutbox, MakeupTask, TimetableVersion
from app.solver import (
    AllocationSpec,
    FacultySpec,
    RoomSpec,
    ScheduledSession,
    SectionSpec,
    TimeSlotSpec,
    evaluate_freeze_window,
    find_recovery_opportunities,
    solve_timetable,
)

router = APIRouter(prefix="/v1/scheduling", tags=["scheduling & self-healing"])
PLANNER_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR")
STAFF_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR", "HOD", "FACULTY")


class TimeSlotIn(BaseModel):
    id: str
    day: str
    period: int = Field(ge=1, le=20)
    is_lunch: bool = False


class RoomIn(BaseModel):
    id: str
    name: str
    capacity: int = Field(ge=1, le=5000)
    room_type: str = "LECTURE"
    building: str = "Main"
    equipment: list[str] = Field(default_factory=list)
    is_available: bool = True


class FacultyIn(BaseModel):
    id: str
    name: str
    max_hours_per_week: int = Field(default=16, ge=1, le=60)
    unavailable_slots: list[str] = Field(default_factory=list)
    preferred_slots: list[str] = Field(default_factory=list)


class SectionIn(BaseModel):
    id: str
    name: str
    student_count: int = Field(ge=1, le=2000)


class AllocationIn(BaseModel):
    id: str
    course_id: str
    course_code: str
    faculty_id: str
    section_id: str
    session_type: str = "LECTURE"
    hours_per_week: int = Field(default=1, ge=1, le=30)
    required_equipment: list[str] = Field(default_factory=list)
    requires_lab: bool = False
    preferred_room_id: str | None = None


class GenerateRequest(BaseModel):
    slots: list[TimeSlotIn]
    rooms: list[RoomIn]
    faculty: list[FacultyIn]
    sections: list[SectionIn]
    allocations: list[AllocationIn]
    persist_draft: bool = True


class FreezeCheckRequest(BaseModel):
    target_time: datetime


class CancelSessionRequest(BaseModel):
    session_id: str = Field(min_length=1, max_length=100)
    course_code: str = Field(min_length=2, max_length=32)
    faculty_id: str = Field(min_length=1, max_length=100)
    section_id: str = Field(min_length=1, max_length=100)
    reason: str = Field(default="", max_length=500)
    priority: int = Field(default=50, ge=1, le=100)


class RecoverySearchRequest(BaseModel):
    makeup_task_id: str
    faculty_id: str
    section_id: str
    cancelled_day: str
    slots: list[TimeSlotIn]
    rooms: list[RoomIn]
    sections: list[SectionIn]
    active_sessions: list[dict[str, object]] = Field(default_factory=list)
    freed_slot_ids: list[str] = Field(default_factory=list)
    faculty_unavailable_slots: list[str] = Field(default_factory=list)
    student_preferred_slots: dict[str, int] = Field(default_factory=dict)


@router.post("/generate")
async def generate_schedule(
    payload: GenerateRequest,
    principal: Principal = Depends(require_roles(*PLANNER_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    result = solve_timetable(
        slots=[TimeSlotSpec(**s.model_dump()) for s in payload.slots],
        rooms=[RoomSpec(**{**r.model_dump(), "equipment": tuple(r.equipment)}) for r in payload.rooms],
        faculty=[
            FacultySpec(
                id=f.id,
                name=f.name,
                max_hours_per_week=f.max_hours_per_week,
                unavailable_slots=frozenset(f.unavailable_slots),
                preferred_slots=frozenset(f.preferred_slots),
            )
            for f in payload.faculty
        ],
        sections=[SectionSpec(**s.model_dump()) for s in payload.sections],
        allocations=[
            AllocationSpec(**{**a.model_dump(), "required_equipment": tuple(a.required_equipment)})
            for a in payload.allocations
        ],
    )

    version_id: str | None = None
    version_number: int | None = None
    if payload.persist_draft and session is not None and result.is_feasible:
        inst_uuid = UUID(principal.institution_id)
        try:
            current_max = await session.scalar(
                select(func.coalesce(func.max(TimetableVersion.version_number), 0)).where(
                    TimetableVersion.institution_id == inst_uuid
                )
            )
            version_number = int(current_max or 0) + 1
            version = TimetableVersion(
                institution_id=inst_uuid,
                version_number=version_number,
                status="DRAFT",
                health_score=result.health.overall_score,
                hard_violations=result.health.hard_violations,
                sessions_payload=[asdict(s) for s in result.sessions],
                created_by=UUID(principal.user_id),
            )
            session.add(version)
            await session.flush()
            version_id = str(version.id)
            session.add(
                EventOutbox(
                    institution_id=inst_uuid,
                    event_type="TIMETABLE_DRAFT_GENERATED",
                    payload={"version_id": version_id, "version_number": version_number},
                )
            )
            session.add(
                AuditLog(
                    institution_id=inst_uuid,
                    actor_user_id=UUID(principal.user_id),
                    action="TIMETABLE_GENERATED",
                    entity_type="TimetableVersion",
                    entity_id=version_id,
                    after_state={"version_number": version_number, "health_score": result.health.overall_score},
                )
            )
            await session.commit()
        except SQLAlchemyError as exc:
            await session.rollback()
            raise HTTPException(status_code=503, detail="could not persist timetable draft") from exc

    return {
        "is_feasible": result.is_feasible,
        "solver_used": result.solver_used,
        "version_id": version_id,
        "version_number": version_number,
        "validation": asdict(result.validation),
        "health": asdict(result.health),
        "sessions": [asdict(s) for s in result.sessions],
        "unscheduled_allocation_ids": result.unscheduled_allocation_ids,
    }


@router.post("/versions/{version_id}/publish")
async def publish_version(
    version_id: UUID,
    principal: Principal = Depends(require_roles(*PLANNER_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    if session is None:
        raise HTTPException(status_code=503, detail="database is not configured")
    inst_uuid = UUID(principal.institution_id)
    try:
        version = await session.scalar(
            select(TimetableVersion).where(
                TimetableVersion.id == version_id,
                TimetableVersion.institution_id == inst_uuid,
            )
        )
        if version is None:
            raise HTTPException(status_code=404, detail="timetable version not found")
        if version.hard_violations > 0:
            raise HTTPException(status_code=422, detail="cannot publish a timetable with hard constraint violations")
        prev_status = version.status
        version.status = "PUBLISHED"
        session.add(
            EventOutbox(
                institution_id=inst_uuid,
                event_type="TIMETABLE_PUBLISHED",
                payload={"version_id": str(version.id), "version_number": version.version_number},
            )
        )
        session.add(
            AuditLog(
                institution_id=inst_uuid,
                actor_user_id=UUID(principal.user_id),
                action="TIMETABLE_PUBLISHED",
                entity_type="TimetableVersion",
                entity_id=str(version.id),
                before_state={"status": prev_status},
                after_state={"status": "PUBLISHED"},
            )
        )
        await session.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(status_code=503, detail="could not publish timetable version") from exc
    return {"id": str(version.id), "version_number": version.version_number, "status": version.status}


@router.post("/freeze-window/check")
async def check_freeze_window(
    payload: FreezeCheckRequest,
    _: Principal = Depends(require_roles(*STAFF_ROLES)),
) -> dict[str, object]:
    return evaluate_freeze_window(payload.target_time)


@router.post("/cancellations", status_code=status.HTTP_201_CREATED)
async def cancel_session_and_enqueue_makeup(
    payload: CancelSessionRequest,
    principal: Principal = Depends(require_roles(*STAFF_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    if session is None:
        raise HTTPException(status_code=503, detail="database is not configured")
    inst_uuid = UUID(principal.institution_id)
    task = MakeupTask(
        institution_id=inst_uuid,
        session_id=payload.session_id,
        course_code=payload.course_code.strip().upper(),
        faculty_id=payload.faculty_id,
        section_id=payload.section_id,
        reason=payload.reason.strip(),
        priority=payload.priority,
        status="PENDING",
    )
    session.add(task)
    try:
        await session.flush()
        session.add(
            EventOutbox(
                institution_id=inst_uuid,
                event_type="CLASS_CANCELLED",
                payload={
                    "makeup_task_id": str(task.id),
                    "session_id": task.session_id,
                    "course_code": task.course_code,
                    "section_id": task.section_id,
                },
            )
        )
        session.add(
            AuditLog(
                institution_id=inst_uuid,
                actor_user_id=UUID(principal.user_id),
                action="CLASS_CANCELLED",
                entity_type="MakeupTask",
                entity_id=str(task.id),
                after_state={"session_id": task.session_id, "status": "PENDING"},
            )
        )
        await session.commit()
    except SQLAlchemyError as exc:
        await session.rollback()
        raise HTTPException(status_code=503, detail="could not record cancellation") from exc
    return {"makeup_task_id": str(task.id), "status": task.status, "priority": task.priority}


@router.post("/recovery/opportunities")
async def search_recovery_opportunities(
    payload: RecoverySearchRequest,
    _: Principal = Depends(require_roles(*STAFF_ROLES)),
) -> dict[str, object]:
    active = [
        ScheduledSession(
            session_id=str(s.get("session_id", "")),
            allocation_id=str(s.get("allocation_id", "")),
            course_id=str(s.get("course_id", "")),
            course_code=str(s.get("course_code", "")),
            faculty_id=str(s.get("faculty_id", "")),
            section_id=str(s.get("section_id", "")),
            room_id=str(s.get("room_id", "")),
            slot_id=str(s.get("slot_id", "")),
            day=str(s.get("day", "")),
            period=int(s.get("period", 1)),
            session_type=str(s.get("session_type", "LECTURE")),
        )
        for s in payload.active_sessions
    ]
    matches = find_recovery_opportunities(
        makeup_task_id=payload.makeup_task_id,
        faculty_id=payload.faculty_id,
        section_id=payload.section_id,
        cancelled_day=payload.cancelled_day,
        slots=[TimeSlotSpec(**s.model_dump()) for s in payload.slots],
        rooms=[RoomSpec(**{**r.model_dump(), "equipment": tuple(r.equipment)}) for r in payload.rooms],
        sections=[SectionSpec(**s.model_dump()) for s in payload.sections],
        active_sessions=active,
        freed_slot_ids=set(payload.freed_slot_ids),
        faculty_unavailable_slots=set(payload.faculty_unavailable_slots),
        student_preferred_slots=payload.student_preferred_slots,
    )
    return {"opportunities": [asdict(m) for m in matches]}
