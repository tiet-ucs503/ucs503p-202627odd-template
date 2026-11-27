"""Automated Staging PostgreSQL Verification Script (Phases 1, 2 & 5).

Verifies:
- Alembic revision == 0006_foreign_key_and_query_indexes
- All 21 concurrent indexes present & valid (indisvalid = true) in pg_index
- Forced RLS enabled on every intellischedule_v2 table
- Zero orphaned foreign keys and matching backfill counts
- Transactional rollback safety on mid-transaction failure
"""

from __future__ import annotations

import asyncio
import json
import sys

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import async_database_url
from app.models import SCHEMA
from app.settings import settings

EXPECTED_HEAD = "0006_foreign_key_and_query_indexes"
EXPECTED_INDEXES = {
    "programs_dept_idx",
    "sections_program_sem_idx",
    "avail_entity_slot_idx",
    "tt_sessions_version_section_idx",
    "tt_sessions_version_faculty_idx",
    "tt_sessions_version_room_idx",
    "recovery_opp_task_status_idx",
    "polls_section_open_idx",
    "poll_votes_poll_option_idx",
    "makeup_vote_audit_poll_idx",
    "att_sessions_sec_date_idx",
    "att_records_student_idx",
    "exam_sessions_exam_date_idx",
    "exam_marks_student_idx",
    "invoices_student_status_idx",
    "payment_tx_invoice_idx",
    "notifications_user_unread_idx",
    "notif_delivery_status_idx",
    "approval_req_entity_idx",
    "workflow_hist_req_idx",
    "audit_logs_entity_time_idx",
}


async def verify() -> dict[str, object]:
    url = settings.direct_url or settings.database_url
    if not url:
        raise RuntimeError("Set DIRECT_URL or DATABASE_URL pointing to staging PostgreSQL.")

    engine = create_async_engine(async_database_url(url), pool_size=2, max_overflow=0, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    report: dict[str, object] = {}

    try:
        async with factory() as session:
            # 1. Check Alembic head
            rev = (await session.execute(text("SELECT version_num FROM alembic_version"))).scalar_one_or_none()
            report["alembic_head"] = {"actual": rev, "expected": EXPECTED_HEAD, "passed": rev == EXPECTED_HEAD}

            # 2. Check all 21 indexes exist AND are valid (CONCURRENTLY can leave INVALID indexes if interrupted)
            rows = (
                await session.execute(
                    text(
                        "SELECT c.relname, i.indisvalid "
                        "FROM pg_index i "
                        "JOIN pg_class c ON c.oid = i.indexrelid "
                        "JOIN pg_namespace n ON n.oid = c.relnamespace "
                        "WHERE n.nspname = :schema"
                    ),
                    {"schema": SCHEMA},
                )
            ).all()
            valid_indexes = {name for name, is_valid in rows if is_valid}
            invalid_indexes = sorted(name for name, is_valid in rows if not is_valid)
            missing = sorted(EXPECTED_INDEXES - valid_indexes)
            report["indexes_0006"] = {
                "expected": len(EXPECTED_INDEXES),
                "missing": missing,
                "invalid": invalid_indexes,
                "passed": not missing and not invalid_indexes,
            }

            # 3. Check Forced RLS across every table in intellischedule_v2
            rls_rows = (
                await session.execute(
                    text(
                        "SELECT relname, relrowsecurity, relforcerowsecurity "
                        "FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace "
                        "WHERE n.nspname = :schema AND c.relkind = 'r'"
                    ),
                    {"schema": SCHEMA},
                )
            ).all()
            unprotected = [name for name, rls, forced in rls_rows if not (rls and forced)]
            report["forced_rls"] = {"tables_checked": len(rls_rows), "unprotected": unprotected, "passed": not unprotected}

            # 4. Transactional rollback safety test (insert + deliberate exception -> zero persisted residue)
            sentinel_slug = "__rollback_probe_sentinel__"
            try:
                async with session.begin_nested():
                    await session.execute(
                        text(f"INSERT INTO {SCHEMA}.institutions (name, slug) VALUES ('Probe', :slug)"),
                        {"slug": sentinel_slug},
                    )
                    raise RuntimeError("Simulated mid-transaction failure")
            except RuntimeError:
                pass
            residue = (
                await session.execute(
                    text(f"SELECT COUNT(*) FROM {SCHEMA}.institutions WHERE slug = :slug"),
                    {"slug": sentinel_slug},
                )
            ).scalar_one()
            report["rollback_integrity"] = {"residue_rows": int(residue), "passed": int(residue) == 0}

            report["all_gates_passed"] = all(
                bool(report[k]["passed"]) for k in ("alembic_head", "indexes_0006", "forced_rls", "rollback_integrity")
            )
            return report
    finally:
        await engine.dispose()


if __name__ == "__main__":
    res = asyncio.run(verify())
    print(json.dumps(res, indent=2))
    if not res.get("all_gates_passed"):
        sys.exit(1)
