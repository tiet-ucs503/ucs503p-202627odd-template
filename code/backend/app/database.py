"""
SQLAlchemy engine/session wiring.

- Production/dev: file-based SQLite at `settings.database_url`
  (`sqlite:///./data/app.db`), directory created on import if missing.
- Tests: pass `database_url="sqlite://"` (SQLAlchemy's in-memory SQLite) to
  `build_engine`/`configure_database` — see app/tests/conftest.py, which
  swaps in a `StaticPool` so the single in-memory connection is shared across
  the whole test session/request instead of vanishing after each connection.
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def build_engine(database_url: str | None = None):
    settings = get_settings()
    url = database_url or settings.database_url

    connect_args = {}
    extra_kwargs = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
        if ":memory:" in url or url == "sqlite://":
            # In-memory SQLite: keep ONE connection alive for the engine's
            # lifetime, otherwise every checkout gets a fresh, empty DB.
            extra_kwargs["poolclass"] = StaticPool
        else:
            db_path = url.split("///")[-1]
            db_dir = os.path.dirname(db_path)
            if db_dir:
                os.makedirs(db_dir, exist_ok=True)

    return create_engine(url, connect_args=connect_args, **extra_kwargs)


engine = build_engine()
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    """FastAPI dependency yielding a request-scoped DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
