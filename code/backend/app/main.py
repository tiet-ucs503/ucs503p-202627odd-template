from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers.auth import router as auth_router
from app.routers.destinations import router as destinations_router
from app.routers.feed import router as feed_router
from app.routers.follows import router as follows_router
from app.routers.health import router as health_router
from app.routers.posts import router as posts_router
from app.routers.uploads import router as uploads_router
from app.routers.users import router as users_router

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix="/api")
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(follows_router)
app.include_router(feed_router)
app.include_router(destinations_router)
app.include_router(uploads_router)
app.include_router(posts_router)