"""Batch 2: Rooms, Laboratories, Time Slots & Availability Blocks backed by intellischedule_v2."""

from __future__ import annotations

import json
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal, require_roles
from app.database import get_session
from app.models import SCHEMA

router = APIRouter(prefix="/v1/resources", tags=["rooms, labs & availability"])
READ_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR", "HOD", "FACULTY")
WRITE_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR")
AVAIL_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR", "HOD", "FACULTY")


def _db(session: AsyncSession | None) -> AsyncSession:
    if session is None:
        raise HTTPException(status_code=503, detail="database is not configured")
    return session


class RoomIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    building: str = Field(default="Main", max_length=120)
    room_type: str = Field(default="LECTURE", max_length=32)
    capacity: int = Field(ge=1, le=5000)
    equipment: list[str] = Field(default_factory=list, max_length=30)
    is_available: bool = True


class TimeSlotIn(BaseModel):
    day_of_week: Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    period_number: int = Field(ge=1, le=16)
    start_time: str = Field(min_length=4, max_length=8)
    end_time: str = Field(min_length=4, max_length=8)
    is_lunch: bool = False


class AvailabilityBlockIn(BaseModel):
    entity_type: Literal["FACULTY", "ROOM"]
    entity_id: UUID
    slot_id: UUID
    reason: str = Field(default="UNAVAILABLE", max_length=64)


@router.get("/rooms")
async def list_rooms(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(require_roles(*READ_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    rows = (
        await db.execute(
            text(f"SELECT id, name, building, room_type, capacity, equipment, is_available FROM {SCHEMA}.rooms WHERE institution_id = :inst ORDER BY name LIMIT :lim OFFSET :off"),
            {"inst": UUID(principal.institution_id), "lim": limit, "off": offset},
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows], "limit": limit, "offset": offset}


@router.post("/rooms", status_code=status.HTTP_201_CREATED)
async def create_room(
    payload: RoomIn,
    principal: Principal = Depends(require_roles(*WRITE_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    try:
        row = (
            await db.execute(
                text(
                    f"INSERT INTO {SCHEMA}.rooms (institution_id, name, building, room_type, capacity, equipment, is_available) "
                    f"VALUES (:inst, :name, :bldg, :rtype, :cap, CAST(:eq AS jsonb), :avail) "
                    f"RETURNING id, name, building, room_type, capacity, equipment, is_available"
                ),
                {
                    "inst": UUID(principal.institution_id),
                    "name": payload.name.strip(),
                    "bldg": payload.building.strip(),
                    "rtype": payload.room_type.strip().upper(),
                    "cap": payload.capacity,
                    "eq": json.dumps(payload.equipment),
                    "avail": payload.is_available,
                },
            )
        ).mappings().one()
        await db.commit()
        return dict(row)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="room with this name already exists") from exc


@router.get("/time-slots")
async def list_time_slots(
    principal: Principal = Depends(require_roles(*READ_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    rows = (
        await db.execute(
            text(f"SELECT id, day_of_week, period_number, start_time, end_time, is_lunch FROM {SCHEMA}.time_slots WHERE institution_id = :inst ORDER BY day_of_week, period_number"),
            {"inst": UUID(principal.institution_id)},
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.post("/time-slots", status_code=status.HTTP_201_CREATED)
async def create_time_slot(
    payload: TimeSlotIn,
    principal: Principal = Depends(require_roles(*WRITE_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    try:
        row = (
            await db.execute(
                text(
                    f"INSERT INTO {SCHEMA}.time_slots (institution_id, day_of_week, period_number, start_time, end_time, is_lunch) "
                    f"VALUES (:inst, :day, :per, :st, :en, :lunch) RETURNING id, day_of_week, period_number, start_time, end_time, is_lunch"
                ),
                {
                    "inst": UUID(principal.institution_id),
                    "day": payload.day_of_week,
                    "per": payload.period_number,
                    "st": payload.start_time,
                    "en": payload.end_time,
                    "lunch": payload.is_lunch,
                },
            )
        ).mappings().one()
        await db.commit()
        return dict(row)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="time slot already exists for this day/period") from exc


@router.post("/availability", status_code=status.HTTP_201_CREATED)
async def add_availability_block(
    payload: AvailabilityBlockIn,
    principal: Principal = Depends(require_roles(*AVAIL_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    if principal.role == "FACULTY" and (payload.entity_type != "FACULTY" or str(payload.entity_id) != principal.user_id):
        raise HTTPException(status_code=403, detail="faculty may only modify their own availability")
    db = _db(session)
    try:
        row = (
            await db.execute(
                text(
                    f"INSERT INTO {SCHEMA}.availability_blocks (institution_id, entity_type, entity_id, slot_id, reason) "
                    f"VALUES (:inst, :etype, :eid, :slot, :reason) RETURNING id, entity_type, entity_id, slot_id, reason"
                ),
                {
                    "inst": UUID(principal.institution_id),
                    "etype": payload.entity_type,
                    "eid": payload.entity_id,
                    "slot": payload.slot_id,
                    "reason": payload.reason.strip(),
                },
            )
        ).mappings().one()
        await db.commit()
        return dict(row)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="availability block already exists or slot is invalid") from exc
