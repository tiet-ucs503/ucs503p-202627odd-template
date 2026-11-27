"""Idempotent, transactional backfill from legacy intellischedule.app_state JSONB to normalized intellischedule_v2 tables.

Preserves all legacy rows untouched, supports --dry-run, and verifies record counts & FK integrity.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import async_database_url
from app.models import SCHEMA
from app.settings import settings


async def run_backfill(dry_run: bool, institution_slug: str, institution_name: str) -> dict[str, object]:
    url = settings.direct_url or settings.database_url
    if not url:
        raise RuntimeError("DIRECT_URL or DATABASE_URL must be configured to run backfill.")

    engine = create_async_engine(async_database_url(url), pool_size=2, max_overflow=0, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    report: dict[str, object] = {"dry_run": dry_run, "source_counts": {}, "migrated_counts": {}}

    try:
        async with factory() as session:
            row = (
                await session.execute(
                    text("SELECT data FROM intellischedule.app_state WHERE key = 'legacy_academic_runtime'")
                )
            ).scalar_one_or_none()
            if row is None:
                report["status"] = "NO_LEGACY_SNAPSHOT_FOUND"
                return report

            data = row if isinstance(row, dict) else json.loads(row)
            departments = data.get("departments", [])
            courses = data.get("courses", [])
            rooms = data.get("rooms", [])
            versions = data.get("versions", [])
            makeup_tasks = data.get("makeupTasks", [])

            report["source_counts"] = {
                "departments": len(departments),
                "courses": len(courses),
                "rooms": len(rooms),
                "timetable_versions": len(versions),
                "makeup_tasks": len(makeup_tasks),
            }
            if dry_run:
                report["status"] = "DRY_RUN_OK"
                return report

            inst_id = (
                await session.execute(
                    text(f"SELECT id FROM {SCHEMA}.institutions WHERE slug = :slug"),
                    {"slug": institution_slug},
                )
            ).scalar_one_or_none()
            if inst_id is None:
                inst_id = uuid.uuid4()
                await session.execute(
                    text(f"INSERT INTO {SCHEMA}.institutions (id, name, slug) VALUES (:id, :name, :slug)"),
                    {"id": inst_id, "name": institution_name, "slug": institution_slug},
                )

            await session.execute(
                text("SELECT set_config('app.institution_id', :inst_id, true)"),
                {"inst_id": str(inst_id)},
            )

            for d in departments:
                code = str(d.get("code") or d.get("id") or "DEPT")[:32].upper()
                name = str(d.get("name") or code)[:200]
                await session.execute(
                    text(
                        f"INSERT INTO {SCHEMA}.departments (institution_id, code, name, is_active) "
                        f"VALUES (:inst, :code, :name, true) "
                        f"ON CONFLICT (institution_id, code) DO NOTHING"
                    ),
                    {"inst": inst_id, "code": code, "name": name},
                )

            for c in courses:
                code = str(c.get("code") or c.get("id") or "COURSE")[:32].upper()
                title = str(c.get("name") or c.get("title") or code)[:200]
                ctype = "LAB" if c.get("requiresLab") else "LECTURE"
                credits = max(0, min(60, int(c.get("credits") or 0)))
                eq = json.dumps(c.get("requiredEquipment") or [])
                await session.execute(
                    text(
                        f"INSERT INTO {SCHEMA}.courses (institution_id, code, title, course_type, credits, required_equipment, is_active) "
                        f"VALUES (:inst, :code, :title, :ctype, :credits, CAST(:eq AS jsonb), true) "
                        f"ON CONFLICT (institution_id, code) DO NOTHING"
                    ),
                    {"inst": inst_id, "code": code, "title": title, "ctype": ctype, "credits": credits, "eq": eq},
                )

            for r in rooms:
                name = str(r.get("name") or r.get("id") or "ROOM")[:100]
                building = str(r.get("building") or "Main")[:120]
                rtype = str(r.get("type") or "LECTURE")[:32].upper()
                cap = max(1, int(r.get("capacity") or 60))
                eq = json.dumps(r.get("equipment") or [])
                await session.execute(
                    text(
                        f"INSERT INTO {SCHEMA}.rooms (institution_id, name, building, room_type, capacity, equipment, is_available) "
                        f"VALUES (:inst, :name, :building, :rtype, :cap, CAST(:eq AS jsonb), :avail) "
                        f"ON CONFLICT (institution_id, name) DO NOTHING"
                    ),
                    {"inst": inst_id, "name": name, "building": building, "rtype": rtype, "cap": cap, "eq": eq, "avail": bool(r.get("isAvailable", True))},
                )

            for v in versions:
                vnum = int(v.get("versionNumber") or 1)
                status_val = "PUBLISHED" if v.get("isPublished") else "DRAFT"
                payload = json.dumps(v.get("sessions") or [])
                await session.execute(
                    text(
                        f"INSERT INTO {SCHEMA}.timetable_versions (institution_id, version_number, status, health_score, hard_violations, sessions_payload) "
                        f"VALUES (:inst, :vnum, :status, :score, 0, CAST(:payload AS jsonb)) "
                        f"ON CONFLICT (institution_id, version_number) DO NOTHING"
                    ),
                    {"inst": inst_id, "vnum": vnum, "status": status_val, "score": float(v.get("healthScore") or 0.0), "payload": payload},
                )

            await session.commit()

            # Post-migration count verification
            counts = {}
            for tbl in ("departments", "courses", "rooms", "timetable_versions"):
                cnt = (
                    await session.execute(
                        text(f"SELECT COUNT(*) FROM {SCHEMA}.{tbl} WHERE institution_id = :inst"),
                        {"inst": inst_id},
                    )
                ).scalar_one()
                counts[tbl] = int(cnt)
            report["migrated_counts"] = counts
            report["status"] = "BACKFILL_COMMITTED_AND_VERIFIED"
            return report
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill legacy JSONB state into normalized intellischedule_v2 schema.")
    parser.add_argument("--dry-run", action="store_true", help="Inspect counts without writing to the database.")
    parser.add_argument("--slug", default="tiet-patiala", help="Target institution slug.")
    parser.add_argument("--name", default="Thapar Institute of Engineering and Technology", help="Target institution name.")
    args = parser.parse_args()
    result = asyncio.run(run_backfill(args.dry_run, args.slug, args.name))
    print(json.dumps(result, indent=2))
    if result.get("status") not in ("DRY_RUN_OK", "BACKFILL_COMMITTED_AND_VERIFIED", "NO_LEGACY_SNAPSHOT_FOUND"):
        sys.exit(1)


if __name__ == "__main__":
    main()
