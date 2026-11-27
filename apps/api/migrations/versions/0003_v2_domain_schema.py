"""Add v2 departments, rooms, timetable_versions, makeup_tasks, and audit_logs with forced RLS."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.models import SCHEMA

revision = "0003_v2_domain_schema"
down_revision = "0002_academic_courses"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "departments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("institution_id", "code", name="departments_institution_code_key"),
        schema=SCHEMA,
    )
    op.create_table(
        "rooms",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("building", sa.String(120), nullable=False, server_default="Main"),
        sa.Column("room_type", sa.String(32), nullable=False, server_default="LECTURE"),
        sa.Column("capacity", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("equipment", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("institution_id", "name", name="rooms_institution_name_key"),
        sa.CheckConstraint("capacity > 0", name="rooms_capacity_check"),
        schema=SCHEMA,
    )
    op.create_table(
        "timetable_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="DRAFT"),
        sa.Column("health_score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("hard_violations", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sessions_payload", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("institution_id", "version_number", name="tt_versions_inst_num_key"),
        sa.CheckConstraint("status IN ('DRAFT','APPROVED','PUBLISHED','ARCHIVED')", name="tt_versions_status_check"),
        schema=SCHEMA,
    )
    op.create_table(
        "makeup_tasks",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("session_id", sa.String(100), nullable=False),
        sa.Column("course_code", sa.String(32), nullable=False),
        sa.Column("faculty_id", sa.String(100), nullable=False),
        sa.Column("section_id", sa.String(100), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False, server_default=""),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="50"),
        sa.Column("status", sa.String(16), nullable=False, server_default="PENDING"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('PENDING','MATCHED','SCHEDULED','DECLINED')", name="makeup_tasks_status_check"),
        schema=SCHEMA,
    )
    op.create_table(
        "audit_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(64), nullable=False),
        sa.Column("entity_id", sa.String(100), nullable=False),
        sa.Column("before_state", postgresql.JSONB(), nullable=True),
        sa.Column("after_state", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    for table in ("departments", "rooms", "timetable_versions", "makeup_tasks", "audit_logs"):
        op.create_index(f"{table}_institution_idx", table, ["institution_id"], schema=SCHEMA)
        op.execute(f"ALTER TABLE {SCHEMA}.{table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {SCHEMA}.{table} FORCE ROW LEVEL SECURITY")
        op.execute(f"REVOKE ALL ON {SCHEMA}.{table} FROM PUBLIC")
        op.execute(f"""
            DO $$
            BEGIN
              IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'intellischedule_app') THEN
                GRANT SELECT, INSERT, UPDATE, DELETE ON {SCHEMA}.{table} TO intellischedule_app;
              END IF;
            END
            $$
        """)
        op.execute(f"""
            CREATE POLICY {table}_tenant_scope ON {SCHEMA}.{table}
            USING (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid)
            WITH CHECK (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid)
        """)


def downgrade() -> None:
    for table in ("audit_logs", "makeup_tasks", "timetable_versions", "rooms", "departments"):
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_scope ON {SCHEMA}.{table}")
        op.drop_index(f"{table}_institution_idx", table_name=table, schema=SCHEMA)
        op.drop_table(table, schema=SCHEMA)
