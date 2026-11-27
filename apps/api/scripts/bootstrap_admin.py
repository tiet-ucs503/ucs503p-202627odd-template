"""Create the first institution and map an already-created Supabase Auth user."""
import asyncio
import os
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database import async_database_url
from app.models import Institution, User
from app.settings import settings


async def main() -> None:
    if not settings.direct_url and not settings.database_url:
        raise SystemExit("Set DIRECT_URL or DATABASE_URL")
    auth_user_id = uuid.UUID(os.environ["BOOTSTRAP_AUTH_USER_ID"])
    slug = os.environ["BOOTSTRAP_INSTITUTION_SLUG"].strip().lower()
    institution_name = os.environ["BOOTSTRAP_INSTITUTION_NAME"].strip()
    email = os.environ["BOOTSTRAP_ADMIN_EMAIL"].strip().lower()
    display_name = os.environ["BOOTSTRAP_ADMIN_NAME"].strip()
    if not all((slug, institution_name, email, display_name)):
        raise SystemExit("Institution and admin identity values must not be blank")
    url = async_database_url(settings.direct_url or settings.database_url)
    engine = create_async_engine(url, pool_size=1, max_overflow=0, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory.begin() as session:
            institution = await session.scalar(select(Institution).where(Institution.slug == slug))
            if institution is None:
                institution = Institution(name=institution_name, slug=slug)
                session.add(institution)
                await session.flush()
            user = await session.scalar(select(User).where(User.institution_id == institution.id, User.auth_user_id == auth_user_id))
            if user is None:
                session.add(User(institution_id=institution.id, auth_user_id=auth_user_id, email=email, display_name=display_name, role="SUPER_ADMIN", status="ACTIVE"))
            elif user.email.lower() != email or user.role != "SUPER_ADMIN":
                raise RuntimeError("Auth user is already mapped with different identity or role; refusing to overwrite")
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())

