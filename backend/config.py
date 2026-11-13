"""All configuration in one place, read from environment variables / backend/.env."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
load_dotenv(BASE_DIR / ".env")


def _flag(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Settings:
    def __init__(self) -> None:
        self.jwt_secret: str = os.getenv("JWT_SECRET_KEY", "").strip()
        if not self.jwt_secret:
            raise RuntimeError(
                "JWT_SECRET_KEY is not set. Copy backend/.env.example to backend/.env "
                "and set JWT_SECRET_KEY to a long random string."
            )
        self.jwt_algorithm: str = "HS256"
        self.token_expire_minutes: int = int(os.getenv("TOKEN_EXPIRE_MINUTES", str(60 * 24)))

        # bcrypt work factor. 12 is the library default; tests lower it to run fast.
        self.bcrypt_rounds: int = int(os.getenv("BCRYPT_ROUNDS", "12"))

        # Off unless explicitly switched on. See routers/auth.py::demo_login.
        self.demo_mode: bool = _flag("DEMO_MODE", False)

        self.database_url: str = os.getenv(
            "DATABASE_URL", f"sqlite:///{(BASE_DIR / 'mathverse.db').as_posix()}"
        )
        self.cors_origins: list[str] = [
            o.strip()
            for o in os.getenv(
                "CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
            ).split(",")
            if o.strip()
        ]
        self.groq_api_key: str = os.getenv("GROQ_API_KEY", "").strip()
        self.groq_model: str = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")


settings = Settings()
