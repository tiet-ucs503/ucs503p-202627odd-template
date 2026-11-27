"""Idempotent PostgreSQL loader for third_year_computer_synthetic_dataset.xlsx into intellischedule_v2."""

from __future__ import annotations

import asyncio
import json
import uuid
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import async_database_url
from app.models import SCHEMA
from app.settings import settings

DATASET_JSON = Path(__file__).resolve().parents[3] / "src" / "server" / "thirdYearDataset.json"


async def load_into_postgres(slug: str = "tiet-patiala", name: str = "Thapar Institute of Engineering and Technology") -> dict[str, int]:
    url = settings.direct_url or settings.database_url
    if not url:
        raise RuntimeError("Set DIRECT_URL or DATABASE_URL to load third_year_computer_synthetic_dataset into PostgreSQL.")
    ds = json.loads(DATASET_JSON.read_text(encoding="utf-8"))
    engine = create_async_engine(async_database_url(url), pool_size=2, max_overflow=0, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    try:
        async with factory() as session:
            inst_id = (await session.execute(text(f"SELECT id FROM {SCHEMA}.institutions WHERE slug = :s"), {"s": slug})).scalar_one_or_none()
            if inst_id is None:
                inst_id = uuid.uuid4()
                await session.execute(text(f"INSERT INTO {SCHEMA}.institutions (id, name, slug) VALUES (:id, :n, :s)"), {"id": inst_id, "n": name, "s": slug})
            await session.execute(text("SELECT set_config('app.institution_id', :i, true)"), {"i": str(inst_id)})

            for d in ds["departments"]:
                await session.execute(
                    text(f"INSERT INTO {SCHEMA}.departments (institution_id, code, name, is_active) VALUES (:i, :c, :n, true) ON CONFLICT (institution_id, code) DO NOTHING"),
                    {"i": inst_id, "c": d["code"][:32], "n": d["name"][:200]},
                )
            for c in ds["courses"]:
                await session.execute(
                    text(
                        f"INSERT INTO {SCHEMA}.courses (institution_id, code, title, course_type, credits, required_equipment, is_active) "
                        f"VALUES (:i, :c, :t, :ct, :cr, CAST(:eq AS jsonb), true) ON CONFLICT (institution_id, code) DO NOTHING"
                    ),
                    {"i": inst_id, "c": c["code"][:32], "t": c["name"][:200], "ct": "LAB" if c["requiresLab"] else "LECTURE", "cr": int(c["credits"]), "eq": json.dumps(c["requiredEquipment"])},
                )
            for r in ds["rooms"]:
                await session.execute(
                    text(
                        f"INSERT INTO {SCHEMA}.rooms (institution_id, name, building, room_type, capacity, equipment, is_available) "
                        f"VALUES (:i, :n, :b, :rt, :cap, CAST(:eq AS jsonb), true) ON CONFLICT (institution_id, name) DO NOTHING"
                    ),
                    {"i": inst_id, "n": r["name"][:100], "b": r["building"][:120], "rt": r["type"][:32].upper(), "cap": int(r["capacity"]), "eq": json.dumps(r["equipment"])},
                )
            for day in ds["academicYear"]["workingDays"]:
                for idx, slot in enumerate(ds["academicYear"]["timeSlots"], 1):
                    await session.execute(
                        text(
                            f"INSERT INTO {SCHEMA}.time_slots (institution_id, day_of_week, period_number, start_time, end_time, is_lunch) "
                            f"VALUES (:i, :d, :p, :st, :en, false) ON CONFLICT (institution_id, day_of_week, period_number) DO NOTHING"
                        ),
                        {"i": inst_id, "d": day, "p": idx, "st": slot["startTime"][:8], "en": slot["endTime"][:8]},
                    )
            await session.execute(
                text(
                    f"INSERT INTO {SCHEMA}.timetable_versions (institution_id, version_number, status, health_score, hard_violations, sessions_payload) "
                    f"VALUES (:i, 1, 'PUBLISHED', 98.0, 0, CAST(:p AS jsonb)) ON CONFLICT (institution_id, version_number) DO NOTHING"
                ),
                {"i": inst_id, "p": json.dumps(ds["sessions"])},
            )
            await session.commit()
            return {
                "departments": len(ds["departments"]),
                "courses": len(ds["courses"]),
                "rooms": len(ds["rooms"]),
                "time_slots": len(ds["academicYear"]["workingDays"]) * len(ds["academicYear"]["timeSlots"]),
                "timetable_sessions": len(ds["sessions"]),
                "students_in_dataset": len(ds["students"]),
            }
    finally:
        await engine.dispose()


if __name__ == "__main__":
    print(json.dumps(asyncio.run(load_into_postgres()), indent=2))
