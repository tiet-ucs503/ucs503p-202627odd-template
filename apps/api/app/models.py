import uuid

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

SCHEMA = "intellischedule_v2"


class Base(DeclarativeBase):
    pass


class Institution(Base):
    __tablename__ = "institutions"
    __table_args__ = {"schema": SCHEMA}  # noqa: RUF012 - SQLAlchemy declarative option
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("auth_user_id"),
        UniqueConstraint("institution_id", "email"),
        CheckConstraint(
            "role IN ('SUPER_ADMIN','COLLEGE_ADMIN','COORDINATOR','HOD','FACULTY','CR','CLASS_REPRESENTATIVE','STUDENT')"
        ),
        CheckConstraint("status IN ('ACTIVE','PENDING','LOCKED')"),
        {"schema": SCHEMA},
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    auth_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ACTIVE")


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (
        UniqueConstraint("institution_id", "code", name="departments_institution_code_key"),
        {"schema": SCHEMA},
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (
        UniqueConstraint("institution_id", "name", name="rooms_institution_name_key"),
        CheckConstraint("capacity > 0", name="rooms_capacity_check"),
        {"schema": SCHEMA},
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    building: Mapped[str] = mapped_column(String(120), nullable=False, default="Main")
    room_type: Mapped[str] = mapped_column(String(32), nullable=False, default="LECTURE")
    capacity: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    equipment: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")


class AcademicCourse(Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint("institution_id", "code", name="courses_institution_code_key"),
        CheckConstraint("course_type IN ('LECTURE','LAB','PRACTICAL','TUTORIAL')", name="courses_type_check"),
        CheckConstraint("credits BETWEEN 0 AND 60", name="courses_credits_check"),
        {"schema": SCHEMA},
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    course_type: Mapped[str] = mapped_column(String(16), nullable=False, default="LECTURE")
    credits: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    required_equipment: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true")
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class TimetableVersion(Base):
    __tablename__ = "timetable_versions"
    __table_args__ = (
        UniqueConstraint("institution_id", "version_number", name="tt_versions_inst_num_key"),
        CheckConstraint("status IN ('DRAFT','APPROVED','PUBLISHED','ARCHIVED')", name="tt_versions_status_check"),
        {"schema": SCHEMA},
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="DRAFT")
    health_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    hard_violations: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sessions_payload: Mapped[list[dict[str, object]]] = mapped_column(JSONB, nullable=False, default=list)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class MakeupTask(Base):
    __tablename__ = "makeup_tasks"
    __table_args__ = (
        CheckConstraint("status IN ('PENDING','MATCHED','SCHEDULED','DECLINED')", name="makeup_tasks_status_check"),
        {"schema": SCHEMA},
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id: Mapped[str] = mapped_column(String(100), nullable=False)
    course_code: Mapped[str] = mapped_column(String(32), nullable=False)
    faculty_id: Mapped[str] = mapped_column(String(100), nullable=False)
    section_id: Mapped[str] = mapped_column(String(100), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False, default="")
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING")
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = {"schema": SCHEMA}  # noqa: RUF012 - SQLAlchemy declarative option
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(100), nullable=False)
    before_state: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    after_state: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class EventOutbox(Base):
    __tablename__ = "event_outbox"
    __table_args__ = {"schema": SCHEMA}  # noqa: RUF012 - SQLAlchemy declarative option
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    institution_id: Mapped[uuid.UUID] = mapped_column(ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict[str, object]] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="PENDING")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    available_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
