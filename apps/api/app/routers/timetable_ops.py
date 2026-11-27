"""Batch 3: Transactional Manual Timetable Operations (Create, Move, Swap, Lock, Restore, Approvals)."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal, require_roles
from app.database import get_session
from app.models import SCHEMA, AuditLog, EventOutbox

router = APIRouter(prefix="/v1/timetable", tags=["timetable operations"])
PLANNER_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR")
HOD_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD")
ADMIN_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN")


def _db(session: AsyncSession | None) -> AsyncSession:
    if session is None:
        raise HTTPException(status_code=503, detail="database is not configured")
    return session


class SessionCreateIn(BaseModel):
    version_id: UUID
    course_id: UUID
    faculty_user_id: UUID
    section_id: UUID
    room_id: UUID
    slot_id: UUID
    session_type: str = Field(default="LECTURE", max_length=16)


class SessionMoveIn(BaseModel):
    target_slot_id: UUID
    target_room_id: UUID | None = None


class SessionSwapIn(BaseModel):
    session_a_id: UUID
    session_b_id: UUID


class SessionLockIn(BaseModel):
    is_locked: bool


class ApprovalDecisionIn(BaseModel):
    version_id: UUID
    note: str = Field(default="", max_length=400)


@router.post("/sessions", status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreateIn,
    principal: Principal = Depends(require_roles(*PLANNER_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    try:
        row = (
            await db.execute(
                text(
                    f"INSERT INTO {SCHEMA}.timetable_sessions "
                    f"(institution_id, version_id, course_id, faculty_user_id, section_id, room_id, slot_id, session_type, status) "
                    f"VALUES (:inst, :ver, :course, :fac, :sec, :room, :slot, :stype, 'SCHEDULED') "
                    f"RETURNING id, version_id, course_id, faculty_user_id, section_id, room_id, slot_id, status, is_locked"
                ),
                {
                    "inst": inst,
                    "ver": payload.version_id,
                    "course": payload.course_id,
                    "fac": payload.faculty_user_id,
                    "sec": payload.section_id,
                    "room": payload.room_id,
                    "slot": payload.slot_id,
                    "stype": payload.session_type.upper(),
                },
            )
        ).mappings().one()
        db.add(EventOutbox(institution_id=inst, event_type="SESSION_CREATED", payload={"session_id": str(row["id"])}))
        db.add(AuditLog(institution_id=inst, actor_user_id=UUID(principal.user_id), action="SESSION_CREATED", entity_type="TimetableSession", entity_id=str(row["id"])))
        await db.commit()
        return dict(row)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="scheduling conflict: faculty, room, or section is already booked in this slot") from exc


@router.post("/sessions/{session_id}/move")
async def move_session(
    session_id: UUID,
    payload: SessionMoveIn,
    principal: Principal = Depends(require_roles(*PLANNER_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    try:
        current = (
            await db.execute(
                text(f"SELECT id, is_locked, room_id, slot_id FROM {SCHEMA}.timetable_sessions WHERE id = :id AND institution_id = :inst FOR UPDATE"),
                {"id": session_id, "inst": inst},
            )
        ).mappings().one_or_none()
        if current is None:
            raise HTTPException(status_code=404, detail="session not found")
        if current["is_locked"]:
            raise HTTPException(status_code=409, detail="session is locked and cannot be moved")

        new_room = payload.target_room_id or current["room_id"]
        updated = (
            await db.execute(
                text(
                    f"UPDATE {SCHEMA}.timetable_sessions SET slot_id = :slot, room_id = :room "
                    f"WHERE id = :id AND institution_id = :inst RETURNING id, slot_id, room_id"
                ),
                {"slot": payload.target_slot_id, "room": new_room, "id": session_id, "inst": inst},
            )
        ).mappings().one()
        db.add(EventOutbox(institution_id=inst, event_type="SESSION_MOVED", payload={"session_id": str(session_id)}))
        await db.commit()
        return dict(updated)
    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="move rejected: target slot has a faculty, room, or section conflict") from exc


@router.patch("/sessions/{session_id}/lock")
async def lock_session(
    session_id: UUID,
    payload: SessionLockIn,
    principal: Principal = Depends(require_roles(*PLANNER_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    res = await db.execute(
        text(f"UPDATE {SCHEMA}.timetable_sessions SET is_locked = :lk WHERE id = :id AND institution_id = :inst RETURNING id, is_locked"),
        {"lk": payload.is_locked, "id": session_id, "inst": UUID(principal.institution_id)},
    )
    row = res.mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="session not found")
    await db.commit()
    return dict(row)


@router.post("/hod-approval")
async def hod_department_signoff(
    payload: ApprovalDecisionIn,
    principal: Principal = Depends(require_roles(*HOD_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    db.add(
        AuditLog(
            institution_id=inst,
            actor_user_id=UUID(principal.user_id),
            action="HOD_DEPARTMENT_SIGNOFF",
            entity_type="TimetableVersion",
            entity_id=str(payload.version_id),
            after_state={"note": payload.note},
        )
    )
    db.add(EventOutbox(institution_id=inst, event_type="HOD_SIGNOFF_RECORDED", payload={"version_id": str(payload.version_id)}))
    await db.commit()
    return {"status": "RECORDED", "version_id": str(payload.version_id)}


@router.post("/admin-approval")
async def admin_approve_version(
    payload: ApprovalDecisionIn,
    principal: Principal = Depends(require_roles(*ADMIN_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    res = await db.execute(
        text(f"UPDATE {SCHEMA}.timetable_versions SET status = 'APPROVED' WHERE id = :id AND institution_id = :inst AND hard_violations = 0 RETURNING id, status"),
        {"id": payload.version_id, "inst": inst},
    )
    row = res.mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=409, detail="version not found or has hard constraint violations")
    db.add(AuditLog(institution_id=inst, actor_user_id=UUID(principal.user_id), action="ADMIN_TIMETABLE_APPROVED", entity_type="TimetableVersion", entity_id=str(payload.version_id)))
    await db.commit()
    return dict(row)


@router.post("/sessions/swap")
async def swap_sessions(
    payload: SessionSwapIn,
    principal: Principal = Depends(require_roles(*PLANNER_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    """Deadlock-free atomic swap: locks both rows in deterministic UUID order (ORDER BY id FOR UPDATE)."""
    if payload.session_a_id == payload.session_b_id:
        raise HTTPException(status_code=400, detail="cannot swap a session with itself")
    db = _db(session)
    inst = UUID(principal.institution_id)
    ordered_ids = sorted([payload.session_a_id, payload.session_b_id], key=str)
    try:
        rows = (
            await db.execute(
                text(
                    f"SELECT id, slot_id, room_id, is_locked FROM {SCHEMA}.timetable_sessions "
                    f"WHERE institution_id = :inst AND id IN (:id1, :id2) ORDER BY id FOR UPDATE"
                ),
                {"inst": inst, "id1": ordered_ids[0], "id2": ordered_ids[1]},
            )
        ).mappings().all()
        if len(rows) != 2:
            raise HTTPException(status_code=404, detail="one or both sessions were not found")
        if any(r["is_locked"] for r in rows):
            raise HTTPException(status_code=409, detail="cannot swap a locked session")

        a, b = rows[0], rows[1]
        # Temporarily mark CANCELLED to avoid transient unique-index collisions during in-place swap
        await db.execute(text(f"UPDATE {SCHEMA}.timetable_sessions SET status = 'CANCELLED' WHERE id IN (:id1, :id2)"), {"id1": a["id"], "id2": b["id"]})
        await db.execute(
            text(f"UPDATE {SCHEMA}.timetable_sessions SET slot_id = :slot, room_id = :room, status = 'SCHEDULED' WHERE id = :id"),
            {"slot": b["slot_id"], "room": b["room_id"], "id": a["id"]},
        )
        await db.execute(
            text(f"UPDATE {SCHEMA}.timetable_sessions SET slot_id = :slot, room_id = :room, status = 'SCHEDULED' WHERE id = :id"),
            {"slot": a["slot_id"], "room": a["room_id"], "id": b["id"]},
        )
        db.add(EventOutbox(institution_id=inst, event_type="SESSIONS_SWAPPED", payload={"a": str(a["id"]), "b": str(b["id"])}))
        await db.commit()
        return {"swapped": [str(a["id"]), str(b["id"])]}
    except HTTPException:
        await db.rollback()
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="swap rejected due to a faculty, room, or section conflict") from exc
