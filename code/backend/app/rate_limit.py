from collections import deque
from threading import Lock
from time import monotonic

from fastapi import HTTPException, Request, status


class InMemoryRateLimiter:
    def __init__(self, limit: int, window_seconds: int) -> None:
        if limit < 1 or window_seconds < 1:
            raise ValueError("Rate-limit limit and window must be positive")
        self.limit = limit
        self.window_seconds = window_seconds
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(self, key: str) -> None:
        now = monotonic()
        cutoff = now - self.window_seconds
        with self._lock:
            events = self._events.setdefault(key, deque())
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= self.limit:
                retry_after = max(1, int(events[0] + self.window_seconds - now))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many coaching requests. Try again later.",
                    headers={"Retry-After": str(retry_after)},
                )
            events.append(now)

    def clear(self) -> None:
        with self._lock:
            self._events.clear()


coaching_rate_limiter = InMemoryRateLimiter(limit=20, window_seconds=60)


def enforce_coaching_rate_limit(request: Request) -> None:
    client_host = request.client.host if request.client else "unknown"
    coaching_rate_limiter.check(client_host)
