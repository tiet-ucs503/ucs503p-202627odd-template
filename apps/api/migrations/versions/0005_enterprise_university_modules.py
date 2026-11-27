"""Add enterprise Attendance, Examinations, Finance, Announcements, Delivery Logs, and Approval Workflows with forced RLS."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.models import SCHEMA

revision = "0005_enterprise_university_modules"
down_revision = "0004_complete_v2_lld_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ATTENDANCE
    op.create_table(
        "attendance_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("timetable_session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.timetable_sessions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("makeup_task_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.makeup_tasks.id", ondelete="SET NULL"), nullable=True),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.courses.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.sections.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("session_date", sa.Date(), nullable=False),
        sa.Column("is_makeup", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("status", sa.String(16), nullable=False, server_default="OPEN"),
        sa.CheckConstraint("status IN ('OPEN','SUBMITTED','LOCKED')", name="att_sessions_status_check"),
        schema=SCHEMA,
    )
    op.create_table(
        "attendance_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attendance_session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.attendance_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("marked_by", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("marked_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('PRESENT','ABSENT','LATE','EXCUSED')", name="att_records_status_check"),
        sa.UniqueConstraint("attendance_session_id", "student_user_id", name="att_records_unique_student_session"),
        schema=SCHEMA,
    )
    op.create_table(
        "attendance_corrections",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("attendance_record_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.attendance_records.id", ondelete="CASCADE"), nullable=False),
        sa.Column("previous_status", sa.String(16), nullable=False),
        sa.Column("new_status", sa.String(16), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("approved_by", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    # MAKEUP VOTE AUDIT HISTORY
    op.create_table(
        "makeup_vote_audit",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("poll_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.polls.id", ondelete="CASCADE"), nullable=False),
        sa.Column("voter_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("previous_option_id", sa.String(64), nullable=True),
        sa.Column("new_option_id", sa.String(64), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    # EXAMINATIONS
    op.create_table(
        "examinations",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("academic_year_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.academic_years.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("exam_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="SCHEDULED"),
        sa.CheckConstraint("exam_type IN ('MID_SEM','END_SEM','QUIZ','PRACTICAL')", name="exam_type_check"),
        schema=SCHEMA,
    )
    op.create_table(
        "exam_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("examination_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.examinations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("course_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.courses.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("room_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.rooms.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("exam_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.String(8), nullable=False),
        sa.Column("end_time", sa.String(8), nullable=False),
        sa.Column("allocated_seats", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("institution_id", "room_id", "exam_date", "start_time", name="exam_room_slot_no_clash_uq"),
        schema=SCHEMA,
    )
    op.create_table(
        "exam_marks",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("exam_session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.exam_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("marks_obtained", sa.Float(), nullable=False),
        sa.Column("max_marks", sa.Float(), nullable=False),
        sa.CheckConstraint("marks_obtained >= 0 AND marks_obtained <= max_marks", name="exam_marks_bounds_check"),
        sa.UniqueConstraint("exam_session_id", "student_user_id", name="exam_marks_unique_student"),
        schema=SCHEMA,
    )

    # FINANCE (Idempotent Payments & Invoices)
    op.create_table(
        "fee_structures",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("program_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.programs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("semester", sa.Integer(), nullable=False),
        sa.Column("amount_minor_units", sa.BigInteger(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.CheckConstraint("amount_minor_units >= 0", name="fee_amount_non_negative"),
        schema=SCHEMA,
    )
    op.create_table(
        "invoices",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("student_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("fee_structure_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.fee_structures.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("amount_due_minor", sa.BigInteger(), nullable=False),
        sa.Column("amount_paid_minor", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(16), nullable=False, server_default="UNPAID"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.CheckConstraint("status IN ('UNPAID','PARTIAL','PAID','REFUNDED','CANCELLED')", name="invoice_status_check"),
        schema=SCHEMA,
    )
    op.create_table(
        "payment_transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invoice_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.invoices.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("idempotency_key", sa.String(128), nullable=False),
        sa.Column("provider_ref", sa.String(128), nullable=False),
        sa.Column("amount_minor", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False, server_default="CAPTURED"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("institution_id", "idempotency_key", name="payment_tx_idempotency_uq"),
        schema=SCHEMA,
    )

    # COMMUNICATION & TARGETED DELIVERY
    op.create_table(
        "announcements",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("author_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("audience_scope", sa.String(24), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("audience_scope IN ('UNIVERSITY','DEPARTMENT','SECTION','ROLE')", name="ann_scope_check"),
        schema=SCHEMA,
    )
    op.create_table(
        "notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("in_app_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("email_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("push_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("institution_id", "user_id", name="notif_pref_unique_user"),
        schema=SCHEMA,
    )
    op.create_table(
        "notification_delivery_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("notification_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.notifications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("channel", sa.String(16), nullable=False),
        sa.Column("delivery_status", sa.String(16), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA,
    )

    # WORKFLOWS & APPROVALS
    op.create_table(
        "approval_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("entity_type", sa.String(48), nullable=False),
        sa.Column("entity_id", sa.String(100), nullable=False),
        sa.Column("requested_by", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("status", sa.String(24), nullable=False, server_default="PENDING"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('PENDING','APPROVED','REJECTED','CANCELLED')", name="approval_req_status_check"),
        schema=SCHEMA,
    )
    op.create_table(
        "workflow_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), primary_key=True),
        sa.Column("institution_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.institutions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("approval_request_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.approval_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey(f"{SCHEMA}.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("from_status", sa.String(24), nullable=False),
        sa.Column("to_status", sa.String(24), nullable=False),
        sa.Column("note", sa.Text(), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        schema=SCHEMA,
    )

    tables = (
        "attendance_sessions",
        "attendance_records",
        "attendance_corrections",
        "makeup_vote_audit",
        "examinations",
        "exam_sessions",
        "exam_marks",
        "fee_structures",
        "invoices",
        "payment_transactions",
        "announcements",
        "notification_preferences",
        "notification_delivery_logs",
        "approval_requests",
        "workflow_history",
    )
    for table in tables:
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
    tables = (
        "workflow_history",
        "approval_requests",
        "notification_delivery_logs",
        "notification_preferences",
        "announcements",
        "payment_transactions",
        "invoices",
        "fee_structures",
        "exam_marks",
        "exam_sessions",
        "examinations",
        "makeup_vote_audit",
        "attendance_corrections",
        "attendance_records",
        "attendance_sessions",
    )
    for table in tables:
        op.execute(f"DROP POLICY IF EXISTS {table}_tenant_scope ON {SCHEMA}.{table}")
        op.drop_index(f"{table}_institution_idx", table_name=table, schema=SCHEMA)
        op.drop_table(table, schema=SCHEMA)
