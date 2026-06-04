"""
Async SQLAlchemy engine and session management for PostgreSQL.
"""

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase
from config import settings


# ── Async Engine ──────────────────────────────────────────────
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,          # Set True for SQL debug logging
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Auto-reconnect stale connections
)

# ── Session Factory ───────────────────────────────────────────
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Declarative Base ─────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Dependency Injection ─────────────────────────────────────
async def get_db() -> AsyncSession:
    """FastAPI dependency that yields an async database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
