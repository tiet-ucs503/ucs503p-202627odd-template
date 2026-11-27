"""Batch 4: Normalized Makeup Polls, Auditable Student Voting & Atomic Apply Winner (FOR UPDATE)."""

from __future__ import annotations

import json
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal, require_roles
from app.database import get_session
from app.models import SCHEMA, AuditLog, EventOutbox

router = APIRouter(prefix="/v1/voting", tags=["makeup polls & voting"])
POLL_CREATE_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR", "HOD", "FACULTY", "CR", "CLASS_REPRESENTATIVE")
VOTER_ROLES = ("STUDENT", "CR", "CLASS_REPRESENTATIVE")
APPLY_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR", "HOD", "FACULTY")


def _db(session: AsyncSession | None) -> AsyncSession:
    if session is None:
        raise HTTPException(status_code=503, detail="database is not configured")
    return session


class PollOptionIn(BaseModel):
    option_id: str = Field(min_length=1, max_length=64)
    day: str
    slot_id: UUID
    room_id: UUID
    label: str = Field(min_length=1, max_length=120)


class PollCreateIn(BaseModel):
    section_id: UUID
    question: str = Field(min_length=5, max_length=240)
    options: list[PollOptionIn] = Field(min_length=2, max_length=6)


class VoteIn(BaseModel):
    option_id: str = Field(min_length=1, max_length=64)


class ApplyWinnerIn(BaseModel):
    version_id: UUID
    course_id: UUID
    faculty_user_id: UUID


@router.get("/polls")
async def list_polls(
    principal: Principal = Depends(require_roles(*POLL_CREATE_ROLES, "STUDENT")),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    rows = (
        await db.execute(
            text(f"SELECT id, section_id, question, options_json, is_open, created_at FROM {SCHEMA}.polls WHERE institution_id = :inst ORDER BY created_at DESC LIMIT 100"),
            {"inst": UUID(principal.institution_id)},
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.post("/polls", status_code=status.HTTP_201_CREATED)
async def create_poll(
    payload: PollCreateIn,
    principal: Principal = Depends(require_roles(*POLL_CREATE_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    opts = [
        {"option_id": o.option_id, "day": o.day, "slot_id": str(o.slot_id), "room_id": str(o.room_id), "label": o.label}
        for o in payload.options
    ]
    row = (
        await db.execute(
            text(
                f"INSERT INTO {SCHEMA}.polls (institution_id, section_id, question, options_json, is_open) "
                f"VALUES (:inst, :sec, :q, CAST(:opts AS jsonb), true) RETURNING id, section_id, question, is_open"
            ),
            {"inst": inst, "sec": payload.section_id, "q": payload.question.strip(), "opts": json.dumps(opts)},
        )
    ).mappings().one()
    db.add(EventOutbox(institution_id=inst, event_type="MAKEUP_POLL_CREATED", payload={"poll_id": str(row["id"]), "section_id": str(payload.section_id)}))
    await db.commit()
    return dict(row)


@router.post("/polls/{poll_id}/vote")
async def cast_vote(
    poll_id: UUID,
    payload: VoteIn,
    principal: Principal = Depends(require_roles(*VOTER_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    voter = UUID(principal.user_id)
    poll = (
        await db.execute(
            text(f"SELECT id, is_open, options_json FROM {SCHEMA}.polls WHERE id = :id AND institution_id = :inst FOR SHARE"),
            {"id": poll_id, "inst": inst},
        )
    ).mappings().one_or_none()
    if poll is None:
        raise HTTPException(status_code=404, detail="poll not found")
    if not poll["is_open"]:
        raise HTTPException(status_code=409, detail="poll is already closed")
    valid_opts = {o["option_id"] for o in (poll["options_json"] or [])}
    if payload.option_id not in valid_opts:
        raise HTTPException(status_code=400, detail="invalid option_id")

    prev = (
        await db.execute(
            text(f"SELECT option_id FROM {SCHEMA}.poll_votes WHERE poll_id = :pid AND voter_user_id = :uid"),
            {"pid": poll_id, "uid": voter},
        )
    ).scalar_one_or_none()

    await db.execute(
        text(
            f"INSERT INTO {SCHEMA}.poll_votes (institution_id, poll_id, voter_user_id, option_id) "
            f"VALUES (:inst, :pid, :uid, :opt) "
            f"ON CONFLICT (poll_id, voter_user_id) DO UPDATE SET option_id = EXCLUDED.option_id"
        ),
        {"inst": inst, "pid": poll_id, "uid": voter, "opt": payload.option_id},
    )
    await db.execute(
        text(
            f"INSERT INTO {SCHEMA}.makeup_vote_audit (institution_id, poll_id, voter_user_id, previous_option_id, new_option_id) "
            f"VALUES (:inst, :pid, :uid, :prev, :new)"
        ),
        {"inst": inst, "pid": poll_id, "uid": voter, "prev": prev, "new": payload.option_id},
    )
    await db.commit()
    return {"poll_id": str(poll_id), "option_id": payload.option_id, "changed_from": prev}


@router.post("/polls/{poll_id}/apply")
async def apply_winning_option(
    poll_id: UUID,
    payload: ApplyWinnerIn,
    principal: Principal = Depends(require_roles(*APPLY_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    """Atomic Apply Winner: locks poll row FOR UPDATE, aggregates votes, validates conflicts via DB constraints, creates makeup session + outbox event."""
    db = _db(session)
    inst = UUID(principal.institution_id)
    try:
        poll = (
            await db.execute(
                text(f"SELECT id, section_id, options_json, is_open FROM {SCHEMA}.polls WHERE id = :id AND institution_id = :inst FOR UPDATE"),
                {"id": poll_id, "inst": inst},
            )
        ).mappings().one_or_none()
        if poll is None:
            raise HTTPException(status_code=404, detail="poll not found")
        if not poll["is_open"]:
            raise HTTPException(status_code=409, detail="poll is already closed or applied")

        tally_rows = (
            await db.execute(
                text(f"SELECT option_id, COUNT(*) AS votes FROM {SCHEMA}.poll_votes WHERE poll_id = :pid GROUP BY option_id"),
                {"pid": poll_id},
            )
        ).mappings().all()
        tally = {r["option_id"]: int(r["votes"]) for r in tally_rows}
        ranked = sorted(poll["options_json"] or [], key=lambda o: (-tally.get(o["option_id"], 0), o["option_id"]))

        created_session = None
        chosen_option = None
        for opt in ranked:
            try:
                async with db.begin_nested():
                    created_session = (
                        await db.execute(
                            text(
                                f"INSERT INTO {SCHEMA}.timetable_sessions "
                                f"(institution_id, version_id, course_id, faculty_user_id, section_id, room_id, slot_id, session_type, status) "
                                f"VALUES (:inst, :ver, :course, :fac, :sec, :room, :slot, 'MAKEUP', 'MAKEUP') "
                                f"RETURNING id, room_id, slot_id"
                            ),
                            {
                                "inst": inst,
                                "ver": payload.version_id,
                                "course": payload.course_id,
                                "fac": payload.faculty_user_id,
                                "sec": poll["section_id"],
                                "room": UUID(opt["room_id"]),
                                "slot": UUID(opt["slot_id"]),
                            },
                        )
                    ).mappings().one()
                    chosen_option = opt
                    break
            except IntegrityError:
                continue

        if created_session is None or chosen_option is None:
            await db.rollback()
            raise HTTPException(status_code=409, detail="all voted poll options have scheduling conflicts")

        await db.execute(text(f"UPDATE {SCHEMA}.polls SET is_open = false WHERE id = :id"), {"id": poll_id})
        db.add(
            EventOutbox(
                institution_id=inst,
                event_type="MAKEUP_WINNER_APPLIED",
                payload={"poll_id": str(poll_id), "session_id": str(created_session["id"]), "section_id": str(poll["section_id"])},
            )
        )
        db.add(
            AuditLog(
                institution_id=inst,
                actor_user_id=UUID(principal.user_id),
                action="POLL_WINNER_APPLIED",
                entity_type="Poll",
                entity_id=str(poll_id),
                after_state={"session_id": str(created_session["id"]), "option_id": chosen_option["option_id"]},
            )
        )
        await db.commit()
        return {"session_id": str(created_session["id"]), "winning_option": chosen_option, "votes": tally.get(chosen_option["option_id"], 0)}
    except HTTPException:
        raise


@router.post("/polls/{poll_id}/close")
async def close_poll(
    poll_id: UUID,
    principal: Principal = Depends(require_roles(*POLL_CREATE_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    res = await db.execute(
        text(f"UPDATE {SCHEMA}.polls SET is_open = false WHERE id = :id AND institution_id = :inst AND is_open = true RETURNING id, is_open"),
        {"id": poll_id, "inst": inst},
    )
    row = res.mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=409, detail="poll not found or already closed")
    db.add(EventOutbox(institution_id=inst, event_type="MAKEUP_POLL_CLOSED", payload={"poll_id": str(poll_id)}))
    await db.commit()
    return dict(row)
