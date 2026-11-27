"""Idempotency-Key deduplication store preventing duplicate state-changing API mutations."""

from __future__ import annotations

import hashlib
import json
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any


class IdempotencyConflictError(ValueError):
    """Raised when the same Idempotency-Key is reused with a different request payload."""


@dataclass(frozen=True)
class IdempotencyRecord:
    key: str
    payload_hash: str
    status_code: int
    response_body: dict[str, Any]
    expires_at: float


def compute_payload_hash(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


class IdempotencyStore:
    """Bounded in-memory idempotency cache (mirrors DB idempotency_keys table for fast-path checks)."""

    def __init__(self, ttl_seconds: float = 3600.0, max_entries: int = 5000) -> None:
        self.ttl_seconds = ttl_seconds
        self.max_entries = max_entries
        self._records: OrderedDict[str, IdempotencyRecord] = OrderedDict()

    def lookup(self, scope: str, key: str, payload: dict[str, Any], now: float | None = None) -> IdempotencyRecord | None:
        ts = now if now is not None else time.monotonic()
        composite = f"{scope}:{key}"
        record = self._records.get(composite)
        if record is None:
            return None
        if record.expires_at <= ts:
            self._records.pop(composite, None)
            return None
        incoming_hash = compute_payload_hash(payload)
        if record.payload_hash != incoming_hash:
            raise IdempotencyConflictError("Idempotency-Key already used with a different payload.")
        self._records.move_to_end(composite)
        return record

    def save(
        self,
        scope: str,
        key: str,
        payload: dict[str, Any],
        status_code: int,
        response_body: dict[str, Any],
        now: float | None = None,
    ) -> IdempotencyRecord:
        ts = now if now is not None else time.monotonic()
        composite = f"{scope}:{key}"
        record = IdempotencyRecord(
            key=key,
            payload_hash=compute_payload_hash(payload),
            status_code=status_code,
            response_body=response_body,
            expires_at=ts + self.ttl_seconds,
        )
        self._records[composite] = record
        self._records.move_to_end(composite)
        while len(self._records) > self.max_entries:
            self._records.popitem(last=False)
        return record
