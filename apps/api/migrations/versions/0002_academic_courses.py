"""Tenant-scoped course catalog and durable catalog events."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.models import SCHEMA

revision = "0002_academic_courses"
down_revision = "0001_tenant_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "courses",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("course_type", sa.String(16), nullable=False, server_default="LECTURE"),
        sa.Column("credits", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("required_equipment", postgresql.JSONB(), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("institution_id", "code", name="courses_institution_code_key"),
        sa.CheckConstraint("course_type IN ('LECTURE','LAB','PRACTICAL','TUTORIAL')", name="courses_type_check"),
        sa.CheckConstraint("credits BETWEEN 0 AND 60", name="courses_credits_check"),
        schema=SCHEMA,
    )
    op.create_index("courses_institution_active_code_idx", "courses", ["institution_id", "is_active", "code"], schema=SCHEMA)
    op.execute(f"ALTER TABLE {SCHEMA}.courses ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {SCHEMA}.courses FORCE ROW LEVEL SECURITY")
    op.execute(f"REVOKE ALL ON {SCHEMA}.courses FROM PUBLIC")
    op.execute(f"""
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'intellischedule_app') THEN
            GRANT SELECT, INSERT, UPDATE, DELETE ON {SCHEMA}.courses TO intellischedule_app;
          END IF;
        END
        $$
    """)
    op.execute(f"""
        CREATE POLICY courses_tenant_scope ON {SCHEMA}.courses
        USING (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid)
        WITH CHECK (institution_id = nullif(current_setting('app.institution_id', true), '')::uuid)
    """)


def downgrade() -> None:
    op.execute(f"DROP POLICY IF EXISTS courses_tenant_scope ON {SCHEMA}.courses")
    op.drop_index("courses_institution_active_code_idx", table_name="courses", schema=SCHEMA)
    op.drop_table("courses", schema=SCHEMA)
