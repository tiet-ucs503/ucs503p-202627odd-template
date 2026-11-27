import pytest
from fastapi import HTTPException

from app.auth import current_principal
from app.main import health


def test_liveness_is_independent_of_database() -> None:
    coroutine = health()
    with pytest.raises(StopIteration) as result:
        coroutine.send(None)
    assert result.value.value == {"status": "ok"}


def test_identity_requires_bearer_token() -> None:
    with pytest.raises(HTTPException) as error:
        current_principal(None, None).send(None)
    assert error.value.status_code == 401

