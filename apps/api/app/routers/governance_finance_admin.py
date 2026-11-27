"""Batches 6, 7 & 8: Targeted Notifications, Announcements, Audit, Idempotent Finance & Admin Workflows."""

from __future__ import annotations

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Header, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal, current_principal, require_roles
from app.database import get_session
from app.models import SCHEMA, AuditLog, EventOutbox

router = APIRouter(prefix="/v1", tags=["notifications, finance & admin"])
ADMIN_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN")
STAFF_ROLES = ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR", "HOD")


def _db(session: AsyncSession | None) -> AsyncSession:
    if session is None:
        raise HTTPException(status_code=503, detail="database is not configured")
    return session


class AnnouncementIn(BaseModel):
    audience_scope: Literal["UNIVERSITY", "DEPARTMENT", "SECTION", "ROLE"]
    target_id: UUID | None = None
    title: str = Field(min_length=3, max_length=200)
    body: str = Field(min_length=3, max_length=2000)


class PaymentCallbackIn(BaseModel):
    invoice_id: UUID
    provider_ref: str = Field(min_length=3, max_length=128)
    amount_minor: int = Field(gt=0)


class UserStatusUpdateIn(BaseModel):
    status: Literal["ACTIVE", "PENDING", "LOCKED"]


@router.get("/notifications")
async def list_my_notifications(
    principal: Principal = Depends(current_principal),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    rows = (
        await db.execute(
            text(
                f"SELECT id, title, body, channel, is_read, created_at FROM {SCHEMA}.notifications "
                f"WHERE institution_id = :inst AND (recipient_user_id = :uid OR recipient_user_id IS NULL) "
                f"ORDER BY created_at DESC LIMIT 100"
            ),
            {"inst": UUID(principal.institution_id), "uid": UUID(principal.user_id)},
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.post("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    principal: Principal = Depends(current_principal),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    res = await db.execute(
        text(
            f"UPDATE {SCHEMA}.notifications SET is_read = true "
            f"WHERE id = :id AND institution_id = :inst AND (recipient_user_id = :uid OR recipient_user_id IS NULL)"
        ),
        {"id": notification_id, "inst": UUID(principal.institution_id), "uid": UUID(principal.user_id)},
    )
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="notification not found")
    await db.commit()
    return {"id": str(notification_id), "is_read": True}


@router.post("/announcements", status_code=status.HTTP_201_CREATED)
async def create_announcement(
    payload: AnnouncementIn,
    principal: Principal = Depends(require_roles(*STAFF_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    row = (
        await db.execute(
            text(
                f"INSERT INTO {SCHEMA}.announcements (institution_id, author_user_id, audience_scope, target_id, title, body) "
                f"VALUES (:inst, :author, :scope, :tid, :title, :body) RETURNING id, audience_scope, title, created_at"
            ),
            {
                "inst": inst,
                "author": UUID(principal.user_id),
                "scope": payload.audience_scope,
                "tid": payload.target_id,
                "title": payload.title.strip(),
                "body": payload.body.strip(),
            },
        )
    ).mappings().one()
    db.add(EventOutbox(institution_id=inst, event_type="ANNOUNCEMENT_PUBLISHED", payload={"announcement_id": str(row["id"]), "scope": payload.audience_scope}))
    await db.commit()
    return dict(row)


@router.get("/governance/audit")
async def list_audit_logs(
    principal: Principal = Depends(require_roles(*STAFF_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    rows = (
        await db.execute(
            text(f"SELECT id, actor_user_id, action, entity_type, entity_id, created_at FROM {SCHEMA}.audit_logs WHERE institution_id = :inst ORDER BY created_at DESC LIMIT 200"),
            {"inst": UUID(principal.institution_id)},
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.post("/finance/payments/callback")
async def process_payment_callback(
    payload: PaymentCallbackIn,
    idempotency_key: str = Header(..., alias="Idempotency-Key", min_length=6, max_length=128),
    principal: Principal = Depends(require_roles(*ADMIN_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    """Idempotent payment settlement using unique (institution_id, idempotency_key) + row lock FOR UPDATE."""
    db = _db(session)
    inst = UUID(principal.institution_id)
    existing = (
        await db.execute(
            text(f"SELECT id, invoice_id, amount_minor, status FROM {SCHEMA}.payment_transactions WHERE institution_id = :inst AND idempotency_key = :ikey"),
            {"inst": inst, "ikey": idempotency_key},
        )
    ).mappings().one_or_none()
    if existing is not None:
        return {"idempotent_replay": True, "transaction": dict(existing)}

    inv = (
        await db.execute(
            text(f"SELECT id, amount_due_minor, amount_paid_minor, version FROM {SCHEMA}.invoices WHERE id = :id AND institution_id = :inst FOR UPDATE"),
            {"id": payload.invoice_id, "inst": inst},
        )
    ).mappings().one_or_none()
    if inv is None:
        raise HTTPException(status_code=404, detail="invoice not found")

    try:
        tx = (
            await db.execute(
                text(
                    f"INSERT INTO {SCHEMA}.payment_transactions (institution_id, invoice_id, idempotency_key, provider_ref, amount_minor, status) "
                    f"VALUES (:inst, :iid, :ikey, :pref, :amt, 'CAPTURED') RETURNING id, invoice_id, amount_minor, status"
                ),
                {"inst": inst, "iid": payload.invoice_id, "ikey": idempotency_key, "pref": payload.provider_ref, "amt": payload.amount_minor},
            )
        ).mappings().one()
        new_paid = int(inv["amount_paid_minor"]) + payload.amount_minor
        new_status = "PAID" if new_paid >= int(inv["amount_due_minor"]) else "PARTIAL"
        await db.execute(
            text(f"UPDATE {SCHEMA}.invoices SET amount_paid_minor = :paid, status = :st, version = version + 1 WHERE id = :id"),
            {"paid": new_paid, "st": new_status, "id": payload.invoice_id},
        )
        db.add(EventOutbox(institution_id=inst, event_type="PAYMENT_CAPTURED", payload={"invoice_id": str(payload.invoice_id), "amount_minor": payload.amount_minor}))
        await db.commit()
        return {"idempotent_replay": False, "transaction": dict(tx), "invoice_status": new_status}
    except IntegrityError:
        await db.rollback()
        return {"idempotent_replay": True, "invoice_id": str(payload.invoice_id)}


@router.get("/admin/users")
async def list_institution_users(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    principal: Principal = Depends(require_roles(*ADMIN_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    rows = (
        await db.execute(
            text(
                f"SELECT id, email, display_name, role, status FROM {SCHEMA}.users "
                f"WHERE institution_id = :inst ORDER BY email LIMIT :lim OFFSET :off"
            ),
            {"inst": UUID(principal.institution_id), "lim": limit, "off": offset},
        )
    ).mappings().all()
    return {"items": [dict(r) for r in rows], "limit": limit, "offset": offset}


@router.patch("/admin/users/{user_id}/status")
async def update_user_status(
    user_id: UUID,
    payload: UserStatusUpdateIn,
    principal: Principal = Depends(require_roles(*ADMIN_ROLES)),
    session: AsyncSession | None = Depends(get_session),
) -> dict[str, object]:
    db = _db(session)
    inst = UUID(principal.institution_id)
    row = (
        await db.execute(
            text(f"UPDATE {SCHEMA}.users SET status = :st WHERE id = :uid AND institution_id = :inst RETURNING id, email, status"),
            {"st": payload.status, "uid": user_id, "inst": inst},
        )
    ).mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="user not found")
    db.add(AuditLog(institution_id=inst, actor_user_id=UUID(principal.user_id), action="USER_STATUS_UPDATED", entity_type="User", entity_id=str(user_id), after_state={"status": payload.status}))
    await db.commit()
    return dict(row)
