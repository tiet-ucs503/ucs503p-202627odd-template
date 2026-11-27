"""Transactional Outbox Background Worker (IntelliSchedule v2 Section 7)."""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.database import session_factory
from app.models import EventOutbox

logger = logging.getLogger("intellischedule.worker")
MAX_ATTEMPTS = 5
POLL_INTERVAL_SECONDS = 5


async def process_outbox_batch(batch_size: int = 20) -> int:
    if session_factory is None:
        return 0
    processed = 0
    now = datetime.now(timezone.utc)
    async with session_factory() as session:
        try:
            rows = (
                await session.scalars(
                    select(EventOutbox)
                    .where(EventOutbox.status == "PENDING", EventOutbox.available_at <= now)
                    .order_by(EventOutbox.available_at, EventOutbox.created_at)
                    .limit(batch_size)
                    .with_for_update(skip_locked=True)
                )
            ).all()
            for event in rows:
                try:
                    logger.info(
                        "Processing outbox event id=%s type=%s institution=%s",
                        event.id,
                        event.event_type,
                        event.institution_id,
                    )
                    event.status = "PROCESSED"
                    processed += 1
                except Exception as exc:  # noqa: BLE001
                    event.attempts += 1
                    if event.attempts >= MAX_ATTEMPTS:
                        event.status = "DEAD_LETTER"
                    else:
                        backoff = min(300, 2 ** event.attempts)
                        event.available_at = now + timedelta(seconds=backoff)
                    logger.warning("Outbox event %s failed (attempt %d): %s", event.id, event.attempts, exc)
            await session.commit()
        except SQLAlchemyError as exc:
            await session.rollback()
            logger.error("Outbox batch query failed: %s", exc)
    return processed


async def run() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    logger.info("IntelliSchedule v2 transactional outbox worker started")
    while True:
        count = await process_outbox_batch()
        if count == 0:
            await asyncio.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    asyncio.run(run())
