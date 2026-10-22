import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.database import AsyncSessionLocal, engine


async def test():
    async with AsyncSessionLocal() as session:
        result = await session.execute(text("SELECT 1"))
        print(result.scalar())

    await engine.dispose()


asyncio.run(test())
