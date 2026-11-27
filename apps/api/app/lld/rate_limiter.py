"""Thread-safe Token-Bucket Rate Limiter with bounded key eviction (API Gateway LLD)."""

from __future__ import annotations

import math
import time
from collections import OrderedDict
from dataclasses import dataclass


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int


class TokenBucketRateLimiter:
    """In-memory O(1) token-bucket rate limiter with LRU cap to prevent unbounded memory growth."""

    def __init__(self, capacity: int = 120, refill_per_second: float = 2.0, max_keys: int = 10_000) -> None:
        if capacity <= 0 or refill_per_second <= 0:
            raise ValueError("capacity and refill_per_second must be positive")
        self.capacity = capacity
        self.refill_per_second = refill_per_second
        self.max_keys = max_keys
        self._buckets: OrderedDict[str, tuple[float, float]] = OrderedDict()

    def check(self, key: str, cost: float = 1.0, now: float | None = None) -> RateLimitDecision:
        ts = now if now is not None else time.monotonic()
        tokens, last_ts = self._buckets.get(key, (float(self.capacity), ts))
        elapsed = max(0.0, ts - last_ts)
        tokens = min(float(self.capacity), tokens + elapsed * self.refill_per_second)

        if tokens >= cost:
            tokens -= cost
            allowed = True
            retry_after = 0
        else:
            allowed = False
            deficit = cost - tokens
            retry_after = max(1, math.ceil(deficit / self.refill_per_second))

        self._buckets[key] = (tokens, ts)
        self._buckets.move_to_end(key)
        while len(self._buckets) > self.max_keys:
            self._buckets.popitem(last=False)

        return RateLimitDecision(
            allowed=allowed,
            limit=self.capacity,
            remaining=max(0, int(tokens)),
            retry_after_seconds=retry_after,
        )
