"""
FastAPI app wiring: CORS, routers, and table creation on startup.

Run with: `uvicorn app.main:app --reload --port 8000` (from backend/, with
the venv active). `/docs` is FastAPI's default Swagger UI.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.routers import auth, calibration, coaching, dashboard, health, sessions

# Import models so their tables are registered on Base.metadata before
# create_all runs.
from app import models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Squat Form Analyzer API", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(dashboard.router)
app.include_router(calibration.router)
app.include_router(coaching.router)
