from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import inspect, text
from fastapi.middleware.cors import CORSMiddleware

import models  # noqa: F401  (registers the tables on Base)
from config import settings
from database import Base, engine
from routers import auth, guardians, reports, sessions


def _add_missing_columns() -> None:
    """
    create_all makes new tables but never changes existing ones. A database made
    before Google sign-in or email verification existed gets the new columns
    here. Existing accounts count as verified. Nothing is removed.
    """
    columns = {c["name"] for c in inspect(engine).get_columns("users")}
    with engine.begin() as conn:
        if "google_sub" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN google_sub VARCHAR"))
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_sub ON users (google_sub)"))
        if "email_verified" not in columns:
            conn.execute(text("ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT 1"))
        for name, kind in [("verify_code_hash", "VARCHAR"), ("verify_expires_at", "DATETIME"),
                           ("verify_sent_at", "DATETIME"), ("verify_attempts", "INTEGER NOT NULL DEFAULT 0")]:
            if name not in columns:
                conn.execute(text(f"ALTER TABLE users ADD COLUMN {name} {kind}"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
    yield


app = FastAPI(
    title="MathVerse API",
    description="Gamified maths practice: accounts, missions, mastery and reports.",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,  # auth is a bearer token in a header, not a cookie
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(guardians.router)
app.include_router(reports.router)


@app.get("/health", tags=["health"])
def health():
    # The Google client ID is public (it is in every page that shows the button).
    # Sending it here keeps it in one place: backend/.env.
    return {"status": "ok", "demo_mode": settings.demo_mode, "google_client_id": settings.google_client_id or None}
