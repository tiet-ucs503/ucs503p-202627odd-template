"""Complete IntelliSchedule v2 9-domain normalized PostgreSQL schema with exclusion/unique indexes & forced RLS."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.models import SCHEMA

revision = "0004_complete_v2_lld_schema"
down_revision = "0003_v2_domain_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Institution Data: academic_years, semesters
    op.create_table(
        "academic_years",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("label", sa.String(64), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("institution_id", "label", name="academic_years_inst_label_key"),
        schema=SCHEMA,
    )

    # 2. Academic Data: programs, sections, course_allocations
    op.create_table(
        "programs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("department_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.departments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code", sa.String(32), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("duration_years", sa.Integer(), nullable=False, server_default="4"),
        sa.UniqueConstraint("institution_id", "code", name="programs_inst_code_key"),
        schema=SCHEMA,
    )
    op.create_table(
        "sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.programs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(64), nullable=False),
        sa.Column("semester", sa.Integer(), nullable=False),
        sa.Column("student_count", sa.Integer(), nullable=False, server_default="60"),
        sa.CheckConstraint("student_count > 0", name="sections_student_count_check"),
        sa.UniqueConstraint("institution_id", "name", "semester", name="sections_inst_name_sem_key"),
        schema=SCHEMA,
    )

    # 3. Resource Data: time_slots, availability_blocks
    op.create_table(
        "time_slots",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("day_of_week", sa.String(16), nullable=False),
        sa.Column("period_number", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.String(8), nullable=False),
        sa.Column("end_time", sa.String(8), nullable=False),
        sa.Column("is_lunch", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("institution_id", "day_of_week", "period_number", name="time_slots_inst_day_period_key"),
        schema=SCHEMA,
    )
    op.create_table(
        "availability_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(16), nullable=False),
        sa.Column("entity_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.time_slots.id", ondelete="CASCADE"), nullable=False),
        sa.Column("reason", sa.String(64), nullable=False, server_default="UNAVAILABLE"),
        sa.CheckConstraint("entity_type IN ('FACULTY','ROOM')", name="avail_entity_type_check"),
        sa.UniqueConstraint("institution_id", "entity_type", "entity_id", "slot_id", name="avail_unique_block_key"),
        schema=SCHEMA,
    )

    # 4. Scheduling Data: normalized timetable_sessions with DB-level double-booking prevention!
    op.create_table(
        "timetable_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.timetable_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.courses.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("faculty_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.sections.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.rooms.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("slot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.time_slots.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("session_type", sa.String(16), nullable=False, server_default="LECTURE"),
        sa.Column("status", sa.String(16), nullable=False, server_default="SCHEDULED"),
        sa.Column("is_locked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.CheckConstraint("status IN ('SCHEDULED','CANCELLED','MAKEUP')", name="tt_sessions_status_check"),
        schema=SCHEMA,
    )
    # Database-enforced hard constraints (zero double-booking for active sessions in a version)
    op.execute(f"""
        CREATE UNIQUE INDEX tt_sessions_no_faculty_clash_uq
        ON {SCHEMA}.timetable_sessions (institution_id, version_id, faculty_user_id, slot_id)
        WHERE status <> 'CANCELLED'
    """)
    op.execute(f"""
        CREATE UNIQUE INDEX tt_sessions_no_room_clash_uq
        ON {SCHEMA}.timetable_sessions (institution_id, version_id, room_id, slot_id)
        WHERE status <> 'CANCELLED'
    """)
    op.execute(f"""
        CREATE UNIQUE INDEX tt_sessions_no_section_clash_uq
        ON {SCHEMA}.timetable_sessions (institution_id, version_id, section_id, slot_id)
        WHERE status <> 'CANCELLED'
    """)

    # 5. Operational & Communication & Governance: recovery_opportunities, polls, poll_votes, notifications, syllabus_progress, idempotency_keys
    op.create_table(
        "recovery_opportunities",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("makeup_task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.makeup_tasks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slot_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.time_slots.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.rooms.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("strategy", sa.String(32), nullable=False),
        sa.Column("match_score", sa.Float(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="PROPOSED"),
        sa.CheckConstraint("status IN ('PROPOSED','ACCEPTED','DECLINED','EXPIRED')", name="recovery_opp_status_check"),
        schema=SCHEMA,
    )
    op.create_table(
        "polls",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.sections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question", sa.String(240), nullable=False),
        sa.Column("options_json", postgresql.JSONB(), nullable=False),
        sa.Column("is_open", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_table(
        "poll_votes",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("poll_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.polls.id", ondelete="CASCADE"), nullable=False),
        sa.Column("voter_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("option_id", sa.String(64), nullable=False),
        sa.UniqueConstraint("poll_id", "voter_user_id", name="poll_votes_one_per_student_key"),
        schema=SCHEMA,
    )
    op.create_table(
        "syllabus_progress",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.courses.id", ondelete="CASCADE"), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.sections.id", ondelete="CASCADE"), nullable=False),
        sa.Column("planned_hours", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_hours", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cancelled_hours", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("institution_id", "course_id", "section_id", name="syllabus_inst_course_sec_key"),
        schema=SCHEMA,
    )
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("recipient_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("channel", sa.String(16), nullable=False, server_default="IN_APP"),
        sa.Column("is_read", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )
    op.create_table(
        "idempotency_keys",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("response_body", postgresql.JSONB(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("institution_id", "idempotency_key", name="idempotency_inst_key_uq"),
        schema=SCHEMA,
    )

    new_tables = (
        "academic_years",
        "programs",
        "sections",
        "time_slots",
        "availability_blocks",
        "timetable_sessions",
        "recovery_opportunities",
        "polls",
        "poll_votes",
        "syllabus_progress",
        "notifications",
        "idempotency_keys",
    )
    for table in new_tables:
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
    new_tables = (
        "idempotency_keys",
        "notifications",
        "syllabus_progress",
        "poll_votes",
        "polls",
        "recovery_opportunities",
        "timetable_sessions",
        "availability_blocks",
        "time_slots",
        "sections",
        "programs",
        "academic_years",
    )
    for table in new_tables:
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_scope ON {SCHEMA}.{table}")
        op.drop_index(f"{table}_institution_idx", table_name=table, schema=SCHEMA)
        op.drop_table(table, schema=SCHEMA)
