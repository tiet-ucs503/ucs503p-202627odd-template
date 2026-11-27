import asyncio
import uuid
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient, PyJWKClientError
from sqlalchemy import select, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import User
from app.settings import settings

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: str
    institution_id: str
    role: str
    email: str


@lru_cache(maxsize=1)
def _jwks_client() -> PyJWKClient:
    if not settings.supabase_jwks_url:
        raise RuntimeError("SUPABASE_JWKS_URL is required")
    return PyJWKClient(settings.supabase_jwks_url, cache_jwk_set=True, lifespan=300)


async def current_principal(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    session: AsyncSession | None = Depends(get_session),
) -> Principal:
    if credentials is None:
        raise HTTPException(status_code=401, detail="authentication required")
    if session is None:
        raise HTTPException(status_code=503, detail="database is not configured")
    if not settings.supabase_url:
        raise HTTPException(status_code=503, detail="identity provider is not configured")
    token = credentials.credentials
    try:
        key = (await asyncio.to_thread(_jwks_client().get_signing_key_from_jwt, token)).key
    except (PyJWKClientError, RuntimeError) as exc:
        raise HTTPException(status_code=503, detail="identity provider keys are unavailable") from exc
    try:
        claims = jwt.decode(
            token, key, algorithms=["ES256", "RS256"],
            audience="authenticated", issuer=f"{settings.supabase_url.rstrip('/')}/auth/v1",
            options={"require": ["sub", "exp", "iat", "iss", "aud"]},
        )
        auth_id = str(uuid.UUID(claims["sub"]))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="invalid or expired access token") from exc
    try:
        await session.execute(
            text("select set_config('app.auth_user_id', :auth_user_id, true)"),
            {"auth_user_id": auth_id},
        )
        result = await session.execute(select(User).where(
            User.auth_user_id == auth_id,
            User.status == "ACTIVE",
        ))
        user = result.scalar_one_or_none()
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="identity database is unavailable") from exc
    if user is None:
        raise HTTPException(status_code=403, detail="active institutional account is required")
    try:
        await session.execute(
            text("select set_config('app.institution_id', :institution_id, true)"),
            {"institution_id": str(user.institution_id)},
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="identity database is unavailable") from exc
    return Principal(str(user.id), str(user.institution_id), user.role, user.email)


def require_roles(*roles: str):
    async def guard(principal: Principal = Depends(current_principal)) -> Principal:
        if principal.role not in roles:
            raise HTTPException(status_code=403, detail="role is not permitted")
        return principal
    return guard

