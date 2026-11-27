from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal, require_roles
from app.database import get_session
from app.models import AcademicCourse, EventOutbox

router = APIRouter(prefix="/v1/academic", tags=["academic catalog"])
CourseType = Literal["LECTURE", "LAB", "PRACTICAL", "TUTORIAL"]
CATALOG_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR")


class CourseFields(BaseModel):
    code: str = Field(min_length=2, max_length=32)
    title: str = Field(min_length=2, max_length=200)
    course_type: CourseType = "LECTURE"
    credits: int = Field(default=0, ge=0, le=60)
    required_equipment: list[str] = Field(default_factory=list, max_length=30)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) < 2:
            raise ValueError("course code must contain at least two non-space characters")
        return normalized

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("course title must contain at least two non-space characters")
        return normalized

    @field_validator("required_equipment")
    @classmethod
    def normalize_equipment(cls, values: list[str]) -> list[str]:
        normalized = [value.strip() for value in values if value.strip()]
        return list(dict.fromkeys(normalized))


class CourseCreate(CourseFields):
    pass


class CourseUpdate(BaseModel):
    code: str | None = Field(default=None, min_length=2, max_length=32)
    title: str | None = Field(default=None, min_length=2, max_length=200)
    course_type: CourseType | None = None
    credits: int | None = Field(default=None, ge=0, le=60)
    required_equipment: list[str] | None = Field(default=None, max_length=30)

    @field_validator("code")
    @classmethod
    def normalize_code(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().upper()
        if len(normalized) < 2:
            raise ValueError("course code must contain at least two non-space characters")
        return normalized

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        if len(normalized) < 2:
            raise ValueError("course title must contain at least two non-space characters")
        return normalized

    @field_validator("required_equipment")
    @classmethod
    def normalize_equipment(cls, values: list[str] | None) -> list[str] | None:
        if values is None:
            return None
        normalized = [value.strip() for value in values if value.strip()]
        return list(dict.fromkeys(normalized))


class CourseView(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    code: str
    title: str
    course_type: str
    credits: int
    required_equipment: list[str]
    is_active: bool


class CoursePage(BaseModel):
    items: list[CourseView]
    total: int
    limit: int
    offset: int


def require_database(session: AsyncSession | None) -> AsyncSession:
    if session is None:
        raise HTTPException(status_code=503, detail="database is not configured")
    return session


async def write_course_event(
    session: AsyncSession,
    principal: Principal,
    course: AcademicCourse,
    event_type: str,
) -> None:
    session.add(EventOutbox(
        institution_id=UUID(principal.institution_id),
        event_type=event_type,
        payload={"course_id": str(course.id), "code": course.code},
    ))


@router.get("/courses", response_model=CoursePage)
async def list_courses(
    search: str | None = Query(default=None, max_length=100),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(require_roles(*CATALOG_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> CoursePage:
    db = require_database(session)
    filters = [AcademicCourse.institution_id == UUID(principal.institution_id), AcademicCourse.is_active.is_(True)]
    if search and search.strip():
        escaped = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        term = f"%{escaped}%"
        filters.append(
            AcademicCourse.code.ilike(term, escape="\\")
            | AcademicCourse.title.ilike(term, escape="\\")
        )
    try:
        total = await db.scalar(select(func.count()).select_from(AcademicCourse).where(*filters)) or 0
        rows = await db.scalars(
            select(AcademicCourse)
            .where(*filters)
            .order_by(AcademicCourse.code, AcademicCourse.id)
            .limit(limit)
            .offset(offset)
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="academic catalog is unavailable") from exc
    return CoursePage(items=list(rows.all()), total=total, limit=limit, offset=offset)


@router.post("/courses", response_model=CourseView, status_code=status.HTTP_201_CREATED)
async def create_course(
    payload: CourseCreate,
    principal: Principal = Depends(require_roles(*CATALOG_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> AcademicCourse:
    db = require_database(session)
    course = AcademicCourse(
        institution_id=UUID(principal.institution_id),
        code=payload.code,
        title=payload.title,
        course_type=payload.course_type,
        credits=payload.credits,
        required_equipment=payload.required_equipment,
    )
    db.add(course)
    try:
        await db.flush()
        await write_course_event(db, principal, course, "COURSE_CREATED")
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="a course with this code already exists in the institution") from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=503, detail="course could not be saved") from exc
    return course


@router.patch("/courses/{course_id}", response_model=CourseView)
async def update_course(
    course_id: UUID,
    payload: CourseUpdate,
    principal: Principal = Depends(require_roles(*CATALOG_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> AcademicCourse:
    db = require_database(session)
    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="at least one course field must be provided")
    null_fields = [field for field, value in updates.items() if value is None]
    if null_fields:
        raise HTTPException(
            status_code=400,
            detail=f"null is not allowed for course fields: {', '.join(sorted(null_fields))}",
        )
    try:
        course = await db.scalar(select(AcademicCourse).where(
            AcademicCourse.id == course_id,
            AcademicCourse.institution_id == UUID(principal.institution_id),
            AcademicCourse.is_active.is_(True),
        ))
        if course is None:
            raise HTTPException(status_code=404, detail="course not found")
        for field, value in updates.items():
            setattr(course, field, value)
        await db.flush()
        await write_course_event(db, principal, course, "COURSE_UPDATED")
        await db.commit()
    except HTTPException:
        raise
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="a course with this code already exists in the institution") from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=503, detail="course could not be saved") from exc
    return course


@router.delete("/courses/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_course(
    course_id: UUID,
    principal: Principal = Depends(require_roles(*CATALOG_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> Response:
    db = require_database(session)
    try:
        course = await db.scalar(select(AcademicCourse).where(
            AcademicCourse.id == course_id,
            AcademicCourse.institution_id == UUID(principal.institution_id),
            AcademicCourse.is_active.is_(True),
        ))
        if course is None:
            raise HTTPException(status_code=404, detail="course not found")
        course.is_active = False
        await db.flush()
        await write_course_event(db, principal, course, "COURSE_ARCHIVED")
        await db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=503, detail="course could not be archived") from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)
