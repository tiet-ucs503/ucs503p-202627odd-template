"""
Centralized app settings (pydantic-settings).

Values come from environment variables (or a `backend/.env`, gitignored) and
fall back to dev-friendly defaults so `uvicorn app.main:app --reload` works
out of the box with zero configuration.

SQLite today; `database_url` is a plain SQLAlchemy URL string so swapping to
Postgres later is a one-line env-var change (`postgresql+psycopg://...`), not
a code change.
"""
from functools import lru_cache
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="APP_", env_file=".env", extra="ignore")

    # SQLAlchemy connection string. Relative path is relative to backend/ (cwd
    # when running uvicorn from that directory).
    database_url: str = "sqlite:///./data/app.db"

    # JWT. The default secret is fine for local dev only — override via
    # APP_JWT_SECRET in any shared/deployed environment.
    jwt_secret: str = "dev-only-insecure-secret-change-me"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24  # 24h

    # CORS: only the Vite dev origin by default.
    cors_origins: list[str] = ["http://localhost:5173"]

    # Google OAuth client ID for token signature verification.
    google_client_id: str = ""
    environment: str = "development"

    # AI Coaching / LLM settings
    gemini_api_key: str = ""
    coaching_model: str = "gemini-1.5-flash"

    @model_validator(mode="after")
    def validate_production_secret(self):
        if self.environment == "production" and self.jwt_secret == "dev-only-insecure-secret-change-me":
            raise ValueError("APP_JWT_SECRET must be changed when APP_ENVIRONMENT=production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
