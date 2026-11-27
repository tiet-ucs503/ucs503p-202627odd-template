"""Circuit Breaker & Exponential Backoff utilities for fault-tolerant external calls."""

from __future__ import annotations

import time
from enum import Enum


class CircuitState(str, Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


class CircuitOpenError(RuntimeError):
    """Raised when a call is short-circuited by an open circuit breaker."""


class CircuitBreaker:
    """Three-state circuit breaker (CLOSED -> OPEN -> HALF_OPEN -> CLOSED)."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout_seconds: float = 30.0,
        half_open_success_threshold: int = 2,
    ) -> None:
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout_seconds = recovery_timeout_seconds
        self.half_open_success_threshold = half_open_success_threshold
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._half_open_successes = 0
        self._opened_at = 0.0

    @property
    def state(self) -> CircuitState:
        return self._state

    def allow_request(self, now: float | None = None) -> bool:
        ts = now if now is not None else time.monotonic()
        if self._state == CircuitState.CLOSED:
            return True
        if self._state == CircuitState.OPEN:
            if ts - self._opened_at >= self.recovery_timeout_seconds:
                self._state = CircuitState.HALF_OPEN
                self._half_open_successes = 0
                return True
            return False
        return True

    def record_success(self) -> None:
        if self._state == CircuitState.HALF_OPEN:
            self._half_open_successes += 1
            if self._half_open_successes >= self.half_open_success_threshold:
                self._state = CircuitState.CLOSED
                self._failure_count = 0
                self._half_open_successes = 0
        else:
            self._failure_count = 0

    def record_failure(self, now: float | None = None) -> None:
        ts = now if now is not None else time.monotonic()
        if self._state == CircuitState.HALF_OPEN:
            self._state = CircuitState.OPEN
            self._opened_at = ts
            self._half_open_successes = 0
            return
        self._failure_count += 1
        if self._failure_count >= self.failure_threshold:
            self._state = CircuitState.OPEN
            self._opened_at = ts
