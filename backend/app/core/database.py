import uuid
import logging
from sqlalchemy import event, select
from sqlalchemy.engine import Engine
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
    AsyncEngine,
)
from sqlalchemy.exc import PendingRollbackError
from sqlalchemy.pool import NullPool, AsyncAdaptedQueuePool
from typing import AsyncGenerator

from .config import settings
from .security import hash_password
from app.models.sqlalchemy.base import Base
from app.models.sqlalchemy.user import User
from app.domain.enums import UserRole

logger = logging.getLogger(__name__)

_engine_kwargs: dict = {
    "echo": settings.DATABASE_ECHO,
    "pool_pre_ping": True,
}

if settings.ENVIRONMENT.value == "production":
    _engine_kwargs["poolclass"] = AsyncAdaptedQueuePool
    _engine_kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
    _engine_kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW
else:
    _engine_kwargs["poolclass"] = NullPool

engine: AsyncEngine = create_async_engine(str(settings.DATABASE_URL), **_engine_kwargs)

if str(settings.DATABASE_URL).startswith("sqlite"):
    @event.listens_for(Engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()


async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_factory() as session:
        try:
            yield session
            await session.commit()
        except PendingRollbackError:
            await session.rollback()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def seed_demo_data() -> None:
    async with async_session_factory() as session:
        try:
            result = await session.execute(select(User).where(User.email == "student@demo.edu"))
            if result.scalar_one_or_none():
                return

            student = User(
                id=uuid.uuid4(),
                email="student@demo.edu",
                password_hash=hash_password("student123"),
                first_name="Demo",
                last_name="Student",
                role=UserRole.STUDENT,
                is_verified=True,
            )
            teacher = User(
                id=uuid.uuid4(),
                email="teacher@demo.edu",
                password_hash=hash_password("teacher123"),
                first_name="Demo",
                last_name="Teacher",
                role=UserRole.TEACHER,
                is_verified=True,
            )
            session.add_all([student, teacher])
            await session.commit()
            logger.info("Demo users seeded")
        except Exception as e:
            logger.warning("Failed to seed demo data: %s", e)
        finally:
            await session.close()


async def close_db() -> None:
    await engine.dispose()
