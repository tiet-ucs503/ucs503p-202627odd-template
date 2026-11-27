"""Normalized FastAPI endpoints for Syllabus Progress, 50k Student Auto-Group Import & Workload Policies."""

from __future__ import annotations

from datetime import date
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal, require_roles
from app.database import get_session
from app.enterprise.student_importer import StudentImportRow, validate_and_map_student_dataset
from app.models import SCHEMA, AuditLog, EventOutbox

router = APIRouter(prefix="/v1", tags=["syllabus, student imports & workload policies"])
READ_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD", "COORDINATOR", "FACULTY")
HOD_ADMIN_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD", "COORDINATOR")
FACULTY_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD", "FACULTY")


def _db(session: AsyncSession | None) -> AsyncSession:
    if session is None:
        raise HTTPException(status_code=503, detail="database is not configured")
    return session


class SyllabusUnitIn(BaseModel):
    course_id: UUID
    unit_number: int = Field(ge=1, le=20)
    title: str = Field(min_length=2, max_length=200)
    planned_sessions: int = Field(default=4, ge=1, le=60)


class SyllabusTopicIn(BaseModel):
    unit_id: UUID
    title: str = Field(min_length=2, max_length=240)
    weight: float = Field(default=1.0, gt=0.0, le=100.0)
    target_date: date | None = None


class TopicProgressIn(BaseModel):
    status: Literal["PENDING", "IN_PROGRESS", "COMPLETED"]
    timetable_session_id: UUID | None = None
    teaching_notes: str = Field(default="", max_length=1000)


class StudentRowIn(BaseModel):
    enrollment_number: str
    email: str
    full_name: str
    department_code: str
    program_code: str
    semester: int = Field(ge=1, le=12)
    section_name: str
    group_code: str = "G1"


class StudentImportPreviewIn(BaseModel):
    rows: list[StudentRowIn] = Field(min_length=1, max_length=60000)


class WorkloadPolicyIn(BaseModel):
    policy_version: str = Field(min_length=2, max_length=32)
    designation: str = Field(min_length=2, max_length=64)
    min_weekly_hours: int = Field(ge=0, le=40)
    max_weekly_hours: int = Field(ge=1, le=60)
    source_type: Literal["REGULATORY", "INSTITUTIONAL", "DEPARTMENTAL"] = "INSTITUTIONAL"


@router.get("/syllabus/units")
async def list_syllabus_units(
    course_id: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(require_roles(*READ_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    if course_id is not None:
        rows = (
            await db.execute(
                text(f"SELECT id, course_id, unit_number, title, planned_sessions FROM {SCHEMA}.syllabus_units WHERE institution_id = :inst AND course_id = :cid ORDER BY unit_number LIMIT :lim OFFSET :off"),
                {"inst": inst, "cid": course_id, "lim": limit, "off": offset},
            )
        ).mappings().all()
    else:
        rows = (
            await db.execute(
                text(f"SELECT id, course_id, unit_number, title, planned_sessions FROM {SCHEMA}.syllabus_units WHERE institution_id = :inst ORDER BY unit_number LIMIT :lim OFFSET :off"),
                {"inst": inst, "lim": limit, "off": offset},
            )
        ).mappings().all()
    return {"items": [dict(r) for r in rows], "limit": limit, "offset": offset}


@router.post("/syllabus/units", status_code=status.HTTP_201_CREATED)
async def create_syllabus_unit(
    payload: SyllabusUnitIn,
    principal: Principal = Depends(require_roles(*HOD_ADMIN_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    try:
        row = (
            await db.execute(
                text(
                    f"INSERT INTO {SCHEMA}.syllabus_units (institution_id, course_id, unit_number, title, planned_sessions) "
                    f"VALUES (:inst, :cid, :unum, :title, :ps) RETURNING id, course_id, unit_number, title, planned_sessions"
                ),
                {"inst": UUID(principal.institution_id), "cid": payload.course_id, "unum": payload.unit_number, "title": payload.title.strip(), "ps": payload.planned_sessions},
            )
        ).mappings().one()
        await db.commit()
        return dict(row)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="unit number already exists for this course") from exc


@router.post("/syllabus/topics", status_code=status.HTTP_201_CREATED)
async def create_syllabus_topic(
    payload: SyllabusTopicIn,
    principal: Principal = Depends(require_roles(*HOD_ADMIN_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    row = (
        await db.execute(
            text(
                f"INSERT INTO {SCHEMA}.syllabus_topics (institution_id, unit_id, title, weight, target_date) "
                f"VALUES (:inst, :uid, :title, :w, :td) RETURNING id, unit_id, title, weight, status, target_date"
            ),
            {"inst": UUID(principal.institution_id), "uid": payload.unit_id, "title": payload.title.strip(), "w": payload.weight, "td": payload.target_date},
        )
    ).mappings().one()
    await db.commit()
    return dict(row)


@router.post("/syllabus/topics/{topic_id}/progress")
async def update_topic_progress(
    topic_id: UUID,
    payload: TopicProgressIn,
    principal: Principal = Depends(require_roles(*FACULTY_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    if payload.status == "COMPLETED":
        if payload.timetable_session_id is None:
            raise HTTPException(status_code=400, detail="timetable_session_id is required to mark a topic COMPLETED")
        sess_status = (
            await db.execute(
                text(f"SELECT status FROM {SCHEMA}.timetable_sessions WHERE id = :sid AND institution_id = :inst"),
                {"sid": payload.timetable_session_id, "inst": inst},
            )
        ).scalar_one_or_none()
        if sess_status is None:
            raise HTTPException(status_code=404, detail="referenced timetable session not found")
        if sess_status == "CANCELLED":
            raise HTTPException(status_code=409, detail="cancelled sessions cannot be counted as completed syllabus progress")

    current = (
        await db.execute(
            text(f"SELECT id, status FROM {SCHEMA}.syllabus_topics WHERE id = :tid AND institution_id = :inst FOR UPDATE"),
            {"tid": topic_id, "inst": inst},
        )
    ).mappings().one_or_none()
    if current is None:
        raise HTTPException(status_code=404, detail="syllabus topic not found")

    await db.execute(
        text(
            f"UPDATE {SCHEMA}.syllabus_topics SET status = :st, completed_at = CASE WHEN :st = 'COMPLETED' THEN now() ELSE completed_at END "
            f"WHERE id = :tid AND institution_id = :inst"
        ),
        {"st": payload.status, "tid": topic_id, "inst": inst},
    )
    await db.execute(
        text(
            f"INSERT INTO {SCHEMA}.syllabus_progress_logs (institution_id, topic_id, faculty_user_id, timetable_session_id, previous_status, new_status, teaching_notes) "
            f"VALUES (:inst, :tid, :fid, :sid, :prev, :st, :notes)"
        ),
        {
            "inst": inst,
            "tid": topic_id,
            "fid": UUID(principal.user_id),
            "sid": payload.timetable_session_id,
            "prev": current["status"],
            "st": payload.status,
            "notes": payload.teaching_notes.strip(),
        },
    )
    db.add(AuditLog(institution_id=inst, actor_user_id=UUID(principal.user_id), action="SYLLABUS_TOPIC_UPDATED", entity_type="SyllabusTopic", entity_id=str(topic_id), before_state={"status": current["status"]}, after_state={"status": payload.status}))
    await db.commit()
    return {"topic_id": str(topic_id), "previous_status": current["status"], "status": payload.status}


@router.get("/syllabus/summary")
async def syllabus_progress_summary(
    course_id: UUID,
    principal: Principal = Depends(require_roles(*READ_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    row = (
        await db.execute(
            text(
                f"SELECT COALESCE(SUM(t.weight), 0) AS total_weight, "
                f"COALESCE(SUM(CASE WHEN t.status = 'COMPLETED' THEN t.weight ELSE 0 END), 0) AS completed_weight "
                f"FROM {SCHEMA}.syllabus_topics t "
                f"JOIN {SCHEMA}.syllabus_units u ON u.id = t.unit_id "
                f"WHERE u.institution_id = :inst AND u.course_id = :cid"
            ),
            {"inst": inst, "cid": course_id},
        )
    ).mappings().one()
    total_w = float(row["total_weight"])
    comp_w = float(row["completed_weight"])
    return {
        "course_id": str(course_id),
        "topic_completion_pct": round((comp_w / total_w) * 100.0, 2) if total_w > 0 else 0.0,
        "completed_weight": comp_w,
        "total_weight": total_w,
    }


@router.post("/catalog/students/import-preview")
async def preview_student_import(
    payload: StudentImportPreviewIn,
    principal: Principal = Depends(require_roles(*HOD_ADMIN_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    dept_rows = (await db.execute(text(f"SELECT code FROM {SCHEMA}.departments WHERE institution_id = :inst AND is_active = true"), {"inst": inst})).scalars().all()
    sec_rows = (
        await db.execute(
            text(
                f"SELECT d.code, s.semester, s.name, s.id FROM {SCHEMA}.sections s "
                f"JOIN {SCHEMA}.programs p ON p.id = s.program_id "
                f"JOIN {SCHEMA}.departments d ON d.id = p.department_id "
                f"WHERE s.institution_id = :inst"
            ),
            {"inst": inst},
        )
    ).all()
    valid_depts = {str(c).upper() for c in dept_rows}
    sec_map = {(str(d).upper(), int(sem), str(name).upper()): str(sid) for d, sem, name, sid in sec_rows}

    _, report = validate_and_map_student_dataset(
        [StudentImportRow(**r.model_dump()) for r in payload.rows],
        valid_depts,
        sec_map,
    )
    return {
        "total_rows": report.total_rows,
        "valid_rows": report.valid_rows,
        "duplicate_rows": report.duplicate_rows,
        "invalid_rows": report.invalid_rows,
        "mapped_sections": report.mapped_timetables,
        "errors": report.errors,
        "group_distribution": report.group_distribution,
    }


@router.get("/workload/policies")
async def list_workload_policies(
    principal: Principal = Depends(require_roles(*READ_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    rows = (
        await db.execute(
            text(f"SELECT id, policy_version, designation, min_weekly_hours, max_weekly_hours, source_type FROM {SCHEMA}.workload_policies WHERE institution_id = :inst ORDER BY policy_version DESC, designation"),
            {"inst": UUID(principal.institution_id)},
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.post("/workload/policies", status_code=status.HTTP_201_CREATED)
async def upsert_workload_policy(
    payload: WorkloadPolicyIn,
    principal: Principal = Depends(require_roles(*HOD_ADMIN_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    if payload.min_weekly_hours > payload.max_weekly_hours:
        raise HTTPException(status_code=400, detail="min_weekly_hours cannot exceed max_weekly_hours")
    db = _db(session)
    inst = UUID(principal.institution_id)
    row = (
        await db.execute(
            text(
                f"INSERT INTO {SCHEMA}.workload_policies (institution_id, policy_version, designation, min_weekly_hours, max_weekly_hours, source_type) "
                f"VALUES (:inst, :ver, :desig, :minh, :maxh, :src) "
                f"ON CONFLICT (institution_id, policy_version, designation) DO UPDATE "
                f"SET min_weekly_hours = EXCLUDED.min_weekly_hours, max_weekly_hours = EXCLUDED.max_weekly_hours, source_type = EXCLUDED.source_type "
                f"RETURNING id, policy_version, designation, min_weekly_hours, max_weekly_hours, source_type"
            ),
            {"inst": inst, "ver": payload.policy_version.strip(), "desig": payload.designation.strip(), "minh": payload.min_weekly_hours, "maxh": payload.max_weekly_hours, "src": payload.source_type},
        )
    ).mappings().one()
    db.add(EventOutbox(institution_id=inst, event_type="WORKLOAD_POLICY_UPDATED", payload={"policy_id": str(row["id"])}))
    await db.commit()
    return dict(row)
