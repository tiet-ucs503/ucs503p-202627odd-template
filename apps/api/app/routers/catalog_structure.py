"""Batch 1: Normalized Departments, Programs & Sections CRUD backed by intellischedule_v2."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal, require_roles
from app.database import get_session
from app.models import SCHEMA

router = APIRouter(prefix="/v1/catalog", tags=["catalog structure"])
READ_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR", "HOD", "FACULTY")
WRITE_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR")


def _db(session: AsyncSession | None) -> AsyncSession:
    if session is None:
        raise HTTPException(status_code=503, detail="database is not configured")
    return session


class DepartmentIn(BaseModel):
    code: str = Field(min_length=2, max_length=32)
    name: str = Field(min_length=2, max_length=200)


class ProgramIn(BaseModel):
    department_id: UUID
    code: str = Field(min_length=2, max_length=32)
    name: str = Field(min_length=2, max_length=200)
    duration_years: int = Field(default=4, ge=1, le=8)


class SectionIn(BaseModel):
    program_id: UUID
    name: str = Field(min_length=1, max_length=64)
    semester: int = Field(ge=1, le=12)
    student_count: int = Field(default=60, ge=1, le=2000)


@router.get("/departments")
async def list_departments(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(require_roles(*READ_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    rows = (
        await db.execute(
            text(f"SELECT id, code, name, is_active FROM {SCHEMA}.departments WHERE institution_id = :inst AND is_active = true ORDER BY code LIMIT :lim OFFSET :off"),
            {"inst": UUID(principal.institution_id), "lim": limit, "off": offset},
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows], "limit": limit, "offset": offset}


@router.post("/departments", status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentIn,
    principal: Principal = Depends(require_roles(*WRITE_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    try:
        row = (
            await db.execute(
                text(
                    f"INSERT INTO {SCHEMA}.departments (institution_id, code, name) "
                    f"VALUES (:inst, :code, :name) RETURNING id, code, name, is_active"
                ),
                {"inst": UUID(principal.institution_id), "code": payload.code.strip().upper(), "name": payload.name.strip()},
            )
        ).mappings().one()
        await db.commit()
        return dict(row)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="department code already exists") from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=503, detail="could not create department") from exc


@router.delete("/departments/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_department(
    department_id: UUID,
    principal: Principal = Depends(require_roles(*WRITE_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> None:
    db = _db(session)
    res = await db.execute(
        text(f"UPDATE {SCHEMA}.departments SET is_active = false WHERE id = :id AND institution_id = :inst"),
        {"id": department_id, "inst": UUID(principal.institution_id)},
    )
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="department not found")
    await db.commit()


@router.get("/programs")
async def list_programs(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(require_roles(*READ_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    rows = (
        await db.execute(
            text(f"SELECT id, department_id, code, name, duration_years FROM {SCHEMA}.programs WHERE institution_id = :inst ORDER BY code LIMIT :lim OFFSET :off"),
            {"inst": UUID(principal.institution_id), "lim": limit, "off": offset},
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows], "limit": limit, "offset": offset}


@router.post("/programs", status_code=status.HTTP_201_CREATED)
async def create_program(
    payload: ProgramIn,
    principal: Principal = Depends(require_roles(*WRITE_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    try:
        row = (
            await db.execute(
                text(
                    f"INSERT INTO {SCHEMA}.programs (institution_id, department_id, code, name, duration_years) "
                    f"VALUES (:inst, :dept, :code, :name, :dur) RETURNING id, department_id, code, name, duration_years"
                ),
                {
                    "inst": UUID(principal.institution_id),
                    "dept": payload.department_id,
                    "code": payload.code.strip().upper(),
                    "name": payload.name.strip(),
                    "dur": payload.duration_years,
                },
            )
        ).mappings().one()
        await db.commit()
        return dict(row)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="program code conflict or invalid department_id") from exc


@router.get("/sections")
async def list_sections(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(require_roles(*READ_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    rows = (
        await db.execute(
            text(f"SELECT id, program_id, name, semester, student_count FROM {SCHEMA}.sections WHERE institution_id = :inst ORDER BY semester, name LIMIT :lim OFFSET :off"),
            {"inst": UUID(principal.institution_id), "lim": limit, "off": offset},
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows], "limit": limit, "offset": offset}


@router.post("/sections", status_code=status.HTTP_201_CREATED)
async def create_section(
    payload: SectionIn,
    principal: Principal = Depends(require_roles(*WRITE_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    try:
        row = (
            await db.execute(
                text(
                    f"INSERT INTO {SCHEMA}.sections (institution_id, program_id, name, semester, student_count) "
                    f"VALUES (:inst, :prog, :name, :sem, :cnt) RETURNING id, program_id, name, semester, student_count"
                ),
                {
                    "inst": UUID(principal.institution_id),
                    "prog": payload.program_id,
                    "name": payload.name.strip(),
                    "sem": payload.semester,
                    "cnt": payload.student_count,
                },
            )
        ).mappings().one()
        await db.commit()
        return dict(row)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="section already exists for this semester or invalid program_id") from exc
