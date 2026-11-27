import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.academic import router as academic_router
from app.auth import Principal, current_principal
from fastapi.security import HTTPAuthorizationCredentials
from app.database import engine
from app.lld.cache import TaggedLRUCache
from app.lld.rate_limiter import TokenBucketRateLimiter
from app.lld.realtime import realtime_hub
from app.observability import RequestContextMiddleware
from app.routers.attendance_and_exams import router as attendance_exams_router
from app.routers.catalog_structure import router as catalog_structure_router
from app.routers.governance_finance_admin import router as governance_finance_admin_router
from app.routers.resources_and_allocations import router as resources_allocations_router
from app.routers.timetable_ops import router as timetable_ops_router
from app.routers.syllabus_and_imports import router as syllabus_imports_router
from app.routers.voting_and_makeup import router as voting_makeup_router
from app.scheduling import router as scheduling_router
from app.settings import settings

api_rate_limiter = TokenBucketRateLimiter(capacity=120, refill_per_second=2.0)
response_cache: TaggedLRUCache[dict[str, object]] = TaggedLRUCache(max_size=1024, default_ttl_seconds=30.0)


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.app_env == "production" and not settings.database_url:
        raise RuntimeError("DATABASE_URL must be configured in production")
    yield
    if engine is not None:
        await engine.dispose()


logging.basicConfig(level=settings.log_level.upper(), format="%(message)s")
app = FastAPI(title="IntelliSchedule API", version="2.0.0", lifespan=lifespan)
app.include_router(academic_router)
app.include_router(scheduling_router)
app.include_router(catalog_structure_router)
app.include_router(resources_allocations_router)
app.include_router(timetable_ops_router)
app.include_router(voting_makeup_router)
app.include_router(attendance_exams_router)
app.include_router(governance_finance_admin_router)
app.include_router(syllabus_imports_router)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings.cors_allowed_origins.split(",") if x.strip()],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID", "Idempotency-Key"],
)


@app.middleware("http")
async def gateway_rate_limit_middleware(request: Request, call_next):
    if request.url.path in ("/health", "/ready"):
        return await call_next(request)
    client_host = request.client.host if request.client else "unknown"
    decision = api_rate_limiter.check(f"{client_host}:{request.url.path}")
    if not decision.allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "rate limit exceeded", "retry_after_seconds": decision.retry_after_seconds},
            headers={
                "Retry-After": str(decision.retry_after_seconds),
                "X-RateLimit-Limit": str(decision.limit),
                "X-RateLimit-Remaining": "0",
            },
        )
    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(decision.limit)
    response.headers["X-RateLimit-Remaining"] = str(decision.remaining)
    return response


@app.get("/health", tags=["health"])
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready", tags=["health"])
async def ready() -> dict[str, str]:
    if engine is None:
        if settings.app_env == "production":
            raise HTTPException(status_code=503, detail="database is not configured")
        return {"status": "ready", "database": "unconfigured-development"}
    try:
        async with engine.connect() as connection:
            await connection.execute(text("select 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="database unavailable") from exc
    return {"status": "ready", "database": "connected"}


@app.get("/v1/me", tags=["identity"])
async def me(principal: Principal = Depends(current_principal)) -> dict[str, str]:
    return {
        "user_id": principal.user_id,
        "institution_id": principal.institution_id,
        "role": principal.role,
        "email": principal.email,
    }


@app.websocket("/v1/ws/{institution_id}")
async def institution_updates_ws(websocket: WebSocket, institution_id: str) -> None:
    from app.database import session_factory

    auth_header = websocket.headers.get("authorization", "")
    token = auth_header[7:].strip() if auth_header.lower().startswith("bearer ") else websocket.query_params.get("token", "").strip()
    if not token or session_factory is None:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    try:
        async with session_factory() as session:
            principal = await current_principal(
                credentials=HTTPAuthorizationCredentials(scheme="Bearer", credentials=token),
                session=session,
            )
    except HTTPException:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    if principal.institution_id != institution_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await realtime_hub.connect(institution_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        realtime_hub.disconnect(institution_id, websocket)
