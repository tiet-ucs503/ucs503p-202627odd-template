import pytest
from fastapi import HTTPException

from app.rate_limit import InMemoryRateLimiter


def test_rate_limiter_rejects_after_limit():
    limiter = InMemoryRateLimiter(limit=2, window_seconds=60)
    limiter.check("client")
    limiter.check("client")

    with pytest.raises(HTTPException) as error:
        limiter.check("client")

    assert error.value.status_code == 429
    assert error.value.headers["Retry-After"]


def test_rate_limiter_tracks_clients_separately():
    limiter = InMemoryRateLimiter(limit=1, window_seconds=60)
    limiter.check("client-a")
    limiter.check("client-b")
