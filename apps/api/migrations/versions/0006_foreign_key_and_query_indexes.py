"""Add foreign-key & hot-query composite indexes using CREATE INDEX CONCURRENTLY (zero write downtime)."""

from alembic import op

from app.models import SCHEMA

revision = "0006_foreign_key_and_query_indexes"
down_revision = "0005_enterprise_university_modules"
branch_labels = None
depends_on = None

INDEXES = [
    ("programs_dept_idx", "programs", ["institution_id", "department_id"]),
    ("sections_program_sem_idx", "sections", ["institution_id", "program_id", "semester"]),
    ("avail_entity_slot_idx", "availability_blocks", ["institution_id", "entity_type", "entity_id", "slot_id"]),
    ("tt_sessions_version_section_idx", "timetable_sessions", ["institution_id", "version_id", "section_id"]),
    ("tt_sessions_version_faculty_idx", "timetable_sessions", ["institution_id", "version_id", "faculty_user_id"]),
    ("tt_sessions_version_room_idx", "timetable_sessions", ["institution_id", "version_id", "room_id"]),
    ("recovery_opp_task_status_idx", "recovery_opportunities", ["institution_id", "makeup_task_id", "status"]),
    ("polls_section_open_idx", "polls", ["institution_id", "section_id", "is_open"]),
    ("poll_votes_poll_option_idx", "poll_votes", ["poll_id", "option_id"]),
    ("makeup_vote_audit_poll_idx", "makeup_vote_audit", ["institution_id", "poll_id", "changed_at"]),
    ("att_sessions_sec_date_idx", "attendance_sessions", ["institution_id", "section_id", "session_date"]),
    ("att_records_student_idx", "attendance_records", ["institution_id", "student_user_id", "status"]),
    ("exam_sessions_exam_date_idx", "exam_sessions", ["institution_id", "examination_id", "exam_date"]),
    ("exam_marks_student_idx", "exam_marks", ["institution_id", "student_user_id"]),
    ("invoices_student_status_idx", "invoices", ["institution_id", "student_user_id", "status"]),
    ("payment_tx_invoice_idx", "payment_transactions", ["institution_id", "invoice_id"]),
    ("notifications_user_unread_idx", "notifications", ["institution_id", "recipient_user_id", "is_read", "created_at"]),
    ("notif_delivery_status_idx", "notification_delivery_logs", ["institution_id", "delivery_status", "attempts"]),
    ("approval_req_entity_idx", "approval_requests", ["institution_id", "entity_type", "entity_id", "status"]),
    ("workflow_hist_req_idx", "workflow_history", ["institution_id", "approval_request_id", "created_at"]),
    ("audit_logs_entity_time_idx", "audit_logs", ["institution_id", "entity_type", "entity_id", "created_at"]),
]


def upgrade() -> None:
    with op.get_context().autocommit_block():
        for name, table, cols in INDEXES:
            cols_sql = ", ".join(cols)
            op.execute(f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {name} ON {SCHEMA}.{table} ({cols_sql})")


def downgrade() -> None:
    with op.get_context().autocommit_block():
        for name, _table, _cols in reversed(INDEXES):
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {SCHEMA}.{name}")
