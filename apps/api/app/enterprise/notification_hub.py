"""Targeted Multi-Channel Notification Hub with Deduplication, Role/Section Scoping & Reconnect Replay."""

from __future__ import annotations

import threading
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any


@dataclass(frozen=True)
class Subscriber:
    subscriber_id: str
    user_id: str
    role: str
    institution_id: str
    department_id: str | None = None
    section_id: str | None = None


@dataclass(frozen=True)
class DomainNotificationEvent:
    seq_id: int
    event_id: str
    event_type: str
    institution_id: str
    title: str
    body: str
    audience_scope: str  # UNIVERSITY | DEPARTMENT | SECTION | USER | ROLE
    target_id: str | None = None
    payload: dict[str, Any] = field(default_factory=dict)
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TargetedNotificationHub:
    """Thread-safe targeted notification broker with event deduplication & Last-Event-ID replay."""

    def __init__(self, max_history: int = 500) -> None:
        self._lock = threading.RLock()
        self._seq = 0
        self._subscribers: dict[str, Subscriber] = {}
        self._inbox: dict[str, list[DomainNotificationEvent]] = {}
        self._seen_event_ids: set[str] = set()
        self._history: deque[DomainNotificationEvent] = deque(maxlen=max_history)

    def subscribe(self, sub: Subscriber) -> None:
        with self._lock:
            self._subscribers[sub.subscriber_id] = sub
            self._inbox.setdefault(sub.subscriber_id, [])

    def unsubscribe(self, subscriber_id: str) -> None:
        with self._lock:
            self._subscribers.pop(subscriber_id, None)

    def _is_authorized(self, sub: Subscriber, event: DomainNotificationEvent) -> bool:
        if sub.institution_id != event.institution_id:
            return False
        if sub.role in ("SUPER_ADMIN", "COLLEGE_ADMIN", "COORDINATOR"):
            return True
        if event.audience_scope == "UNIVERSITY":
            return True
        if event.audience_scope == "USER":
            return sub.user_id == event.target_id
        if event.audience_scope == "SECTION":
            return sub.section_id == event.target_id
        if event.audience_scope == "DEPARTMENT":
            return sub.department_id == event.target_id
        if event.audience_scope == "ROLE":
            return sub.role == event.target_id
        return False

    def publish(
        self,
        event_id: str,
        event_type: str,
        institution_id: str,
        title: str,
        body: str,
        audience_scope: str,
        target_id: str | None = None,
        payload: dict[str, Any] | None = None,
    ) -> DomainNotificationEvent | None:
        with self._lock:
            if event_id in self._seen_event_ids:
                return None  # Duplicate event suppressed
            self._seen_event_ids.add(event_id)
            self._seq += 1
            event = DomainNotificationEvent(
                seq_id=self._seq,
                event_id=event_id,
                event_type=event_type,
                institution_id=institution_id,
                title=title,
                body=body,
                audience_scope=audience_scope,
                target_id=target_id,
                payload=dict(payload or {}),
            )
            self._history.append(event)
            for sid, sub in self._subscribers.items():
                if self._is_authorized(sub, event):
                    self._inbox.setdefault(sid, []).append(event)
            return event

    def get_delivered(self, subscriber_id: str) -> list[DomainNotificationEvent]:
        with self._lock:
            return list(self._inbox.get(subscriber_id, []))

    def replay_since(self, sub: Subscriber, last_seq_id: int) -> list[DomainNotificationEvent]:
        """Synchronizes a reconnecting device with only its authorized missed events."""
        with self._lock:
            return [
                ev
                for ev in self._history
                if ev.seq_id > last_seq_id and self._is_authorized(sub, ev)
            ]
