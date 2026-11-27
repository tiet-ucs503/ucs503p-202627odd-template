"""Add syllabus_units, syllabus_topics, syllabus_progress_logs, student_groups, student_enrollments, and workload_policies with forced RLS."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.models import SCHEMA

revision = "0007_syllabus_hierarchy_and_student_groups"
down_revision = "0006_foreign_key_and_query_indexes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "syllabus_units",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("unit_number", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("planned_sessions", sa.Integer(), nullable=False, server_default="4"),
        sa.UniqueConstraint("institution_id", "course_id", "unit_number", name="syllabus_units_course_num_uq"),
        schema=SCHEMA,
    )
    op.create_table(
        "syllabus_topics",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("unit_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.syllabus_units.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("weight", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="PENDING"),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("weight > 0", name="syllabus_topics_weight_pos"),
        sa.CheckConstraint("status IN ('PENDING','IN_PROGRESS','COMPLETED')", name="syllabus_topics_status_check"),
        schema=SCHEMA,
    )
    op.create_table(
        "syllabus_progress_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topic_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.syllabus_topics.id", ondelete="CASCADE"), nullable=False),
        sa.Column("faculty_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("timetable_session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.timetable_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("previous_status", sa.String(16), nullable=False),
        sa.Column("new_status", sa.String(16), nullable=False),
        sa.Column("teaching_notes", sa.Text(), nullable=False, server_default=""),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_table(
        "student_groups",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.sections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("group_code", sa.String(32), nullable=False),
        sa.Column("group_type", sa.String(24), nullable=False, server_default="LAB"),
        sa.UniqueConstraint("institution_id", "section_id", "group_code", name="student_groups_sec_code_uq"),
        schema=SCHEMA,
    )
    op.create_table(
        "student_enrollments",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("enrollment_number", sa.String(64), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.departments.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.programs.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("semester", sa.Integer(), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.sections.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("group_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.student_groups.id", ondelete="SET NULL"), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("effective_from", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("institution_id", "enrollment_number", "semester", name="student_enroll_num_sem_uq"),
        schema=SCHEMA,
    )
    op.create_table(
        "workload_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("policy_version", sa.String(32), nullable=False),
        sa.Column("designation", sa.String(64), nullable=False),
        sa.Column("min_weekly_hours", sa.Integer(), nullable=False, server_default="8"),
        sa.Column("max_weekly_hours", sa.Integer(), nullable=False, server_default="16"),
        sa.Column("source_type", sa.String(24), nullable=False, server_default="INSTITUTIONAL"),
        sa.CheckConstraint("source_type IN ('REGULATORY','INSTITUTIONAL','DEPARTMENTAL')", name="workload_policy_source_check"),
        sa.UniqueConstraint("institution_id", "policy_version", "designation", name="workload_policy_ver_desig_uq"),
        schema=SCHEMA,
    )

    for table in ("syllabus_units", "syllabus_topics", "syllabus_progress_logs", "student_groups", "student_enrollments", "workload_policies"):
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
    for table in ("workload_policies", "student_enrollments", "student_groups", "syllabus_progress_logs", "syllabus_topics", "syllabus_units"):
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_scope ON {SCHEMA}.{table}")
        op.drop_index(f"{table}_institution_idx", table_name=table, schema=SCHEMA)
        op.drop_table(table, schema=SCHEMA)
