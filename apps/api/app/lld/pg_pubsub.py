"""Distributed Cross-Instance Event Listener (PostgreSQL LISTEN/NOTIFY + Outbox Durable Replay)."""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

logger = logging.getLogger("intellischedule.pubsub")


class DistributedEventBus:
    """In-process + cross-instance event dispatcher with instance-ID echo suppression and deduplication."""

    def __init__(self, instance_id: str | None = None, max_seen: int = 5000) -> None:
        self.instance_id = instance_id or str(uuid.uuid4())
        self._max_seen = max_seen
        self._seen: list[str] = []
        self._seen_set: set[str] = set()
        self._handlers: list[Callable[[dict[str, Any]], Awaitable[None]]] = []

    def on_event(self, handler: Callable[[dict[str, Any]], Awaitable[None]]) -> None:
        self._handlers.append(handler)

    def _mark_seen(self, event_id: str) -> bool:
        if event_id in self._seen_set:
            return False
        self._seen.append(event_id)
        self._seen_set.add(event_id)
        if len(self._seen) > self._max_seen:
            evicted = self._seen.pop(0)
            self._seen_set.discard(evicted)
        return True

    async def dispatch_incoming(self, raw_payload: str) -> bool:
        try:
            payload = json.loads(raw_payload)
        except json.JSONDecodeError:
            return False
        if payload.get("instance_id") == self.instance_id:
            return False  # Echo suppression
        event_id = str(payload.get("event_id") or "")
        if event_id and not self._mark_seen(event_id):
            return False  # Duplicate delivery suppression
        for handler in self._handlers:
            await handler(payload)
        return True
