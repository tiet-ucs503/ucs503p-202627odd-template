"""Batch 5: Normalized Attendance Sessions/Records & Examination Scheduling/Marks."""

from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal, require_roles
from app.database import get_session
from app.models import SCHEMA, EventOutbox

router = APIRouter(prefix="/v1", tags=["attendance & examinations"])
STAFF_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR", "HOD", "FACULTY")
PLANNER_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR")


def _db(session: AsyncSession | None) -> AsyncSession:
    if session is None:
        raise HTTPException(status_code=503, detail="database is not configured")
    return session


class AttendanceSessionIn(BaseModel):
    course_id: UUID
    section_id: UUID
    session_date: date
    timetable_session_id: UUID | None = None
    makeup_task_id: UUID | None = None
    is_makeup: bool = False


class AttendanceRecordIn(BaseModel):
    student_user_id: UUID
    status: Literal["PRESENT", "ABSENT", "LATE", "EXCUSED"]


class ExamSessionIn(BaseModel):
    examination_id: UUID
    course_id: UUID
    room_id: UUID
    exam_date: date
    start_time: str = Field(min_length=4, max_length=8)
    end_time: str = Field(min_length=4, max_length=8)
    allocated_seats: int = Field(ge=1, le=2000)


@router.post("/attendance/sessions", status_code=status.HTTP_201_CREATED)
async def create_attendance_session(
    payload: AttendanceSessionIn,
    principal: Principal = Depends(require_roles(*STAFF_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    row = (
        await db.execute(
            text(
                f"INSERT INTO {SCHEMA}.attendance_sessions "
                f"(institution_id, timetable_session_id, makeup_task_id, course_id, section_id, session_date, is_makeup) "
                f"VALUES (:inst, :tsid, :mtid, :cid, :sid, :dt, :mk) RETURNING id, course_id, section_id, session_date, is_makeup, status"
            ),
            {
                "inst": UUID(principal.institution_id),
                "tsid": payload.timetable_session_id,
                "mtid": payload.makeup_task_id,
                "cid": payload.course_id,
                "sid": payload.section_id,
                "dt": payload.session_date,
                "mk": payload.is_makeup,
            },
        )
    ).mappings().one()
    await db.commit()
    return dict(row)


@router.post("/attendance/sessions/{attendance_session_id}/records")
async def upsert_attendance_record(
    attendance_session_id: UUID,
    payload: AttendanceRecordIn,
    principal: Principal = Depends(require_roles(*STAFF_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    row = (
        await db.execute(
            text(
                f"INSERT INTO {SCHEMA}.attendance_records (institution_id, attendance_session_id, student_user_id, status, marked_by) "
                f"VALUES (:inst, :asid, :stu, :st, :actor) "
                f"ON CONFLICT (attendance_session_id, student_user_id) DO UPDATE SET status = EXCLUDED.status, marked_by = EXCLUDED.marked_by, marked_at = now() "
                f"RETURNING id, attendance_session_id, student_user_id, status"
            ),
            {
                "inst": UUID(principal.institution_id),
                "asid": attendance_session_id,
                "stu": payload.student_user_id,
                "st": payload.status,
                "actor": UUID(principal.user_id),
            },
        )
    ).mappings().one()
    await db.commit()
    return dict(row)


@router.post("/exams/sessions", status_code=status.HTTP_201_CREATED)
async def schedule_exam_session(
    payload: ExamSessionIn,
    principal: Principal = Depends(require_roles(*PLANNER_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    cap = (
        await db.execute(
            text(f"SELECT capacity FROM {SCHEMA}.rooms WHERE id = :rid AND institution_id = :inst AND is_available = true"),
            {"rid": payload.room_id, "inst": inst},
        )
    ).scalar_one_or_none()
    if cap is None:
        raise HTTPException(status_code=404, detail="room not found or unavailable")
    if payload.allocated_seats > int(cap):
        raise HTTPException(status_code=400, detail=f"allocated_seats ({payload.allocated_seats}) exceeds room capacity ({cap})")
    try:
        row = (
            await db.execute(
                text(
                    f"INSERT INTO {SCHEMA}.exam_sessions (institution_id, examination_id, course_id, room_id, exam_date, start_time, end_time, allocated_seats) "
                    f"VALUES (:inst, :eid, :cid, :rid, :dt, :st, :en, :seats) RETURNING id, room_id, exam_date, start_time, allocated_seats"
                ),
                {
                    "inst": inst,
                    "eid": payload.examination_id,
                    "cid": payload.course_id,
                    "rid": payload.room_id,
                    "dt": payload.exam_date,
                    "st": payload.start_time,
                    "en": payload.end_time,
                    "seats": payload.allocated_seats,
                },
            )
        ).mappings().one()
        db.add(EventOutbox(institution_id=inst, event_type="EXAM_SCHEDULED", payload={"exam_session_id": str(row["id"])}))
        await db.commit()
        return dict(row)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="exam room is already booked at this date and time") from exc
