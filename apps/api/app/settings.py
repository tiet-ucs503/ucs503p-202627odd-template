from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    database_url: str | None = None
    direct_url: str | None = None
    supabase_url: str | None = None
    supabase_jwks_url: str | None = None
    cors_allowed_origins: str = "http://localhost:3000"
    solver_time_limit_seconds: int = 30
    log_level: str = "INFO"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

