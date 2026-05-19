"""
VMS Backend - FastAPI Application Entry Point.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import engine, Base

# Import all models so they register with Base.metadata
import models  # noqa: F401

from routers import auth, users, cameras


# ── Lifespan (startup / shutdown) ─────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: Create tables if they don't exist (dev convenience).
    In production, use Alembic migrations instead.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[INFO] Database tables created / verified")
    yield
    # Shutdown: dispose engine
    await engine.dispose()
    print("[INFO] Database connection closed")


# ── FastAPI App ───────────────────────────────────────────────
app = FastAPI(
    title="VMS API",
    description="Video Management System - Backend API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS Middleware ───────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Include Routers ───────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(cameras.router)


# ── Health Check ──────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "service": "VMS API"}


@app.get("/", tags=["System"])
async def root():
    return {
        "message": "VMS API is running",
        "docs": "/docs",
        "health": "/health",
    }
