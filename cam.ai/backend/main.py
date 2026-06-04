"""
VMS Backend - FastAPI Application Entry Point.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
import logging
import sys 
import asyncio

# Cấu hình hiển thị log của ứng dụng (bao gồm log INFO)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
# Thiết lâp ProactorEventLoop để hỗ trợ multiprocess trên Windows
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from config import settings
from database import engine, Base, async_session

# Import all models so they register with Base.metadata
import models  # noqa: F401
from models.camera import Camera

from routers import auth, users, cameras, recordings, events, websockets, clips, system, notifications

from services.mediamtx_service import mediamtx_service
from routers.cameras import _get_mtx_paths

from services.minio_service import minio_service
from tasks.recorder import recording_manager
from tasks.ai_worker import ai_worker_manager
from tasks.cleanup import cleanup_task
from tasks.health_check import health_check_task


async def _sync_cameras_to_mediamtx():
    """
    Đọc toàn bộ camera từ DB và đăng ký lại vào MediaMTX.
    Được gọi mỗi lần backend khởi động để tránh mất path khi MediaMTX restart.
    """
    async with async_session() as db:
        result = await db.execute(select(Camera))
        all_cameras = result.scalars().all()

    registered = 0
    for cam in all_cameras:
        paths = _get_mtx_paths(cam)
        if paths["hd"]:
            ok = await mediamtx_service.add_path(paths["hd"], cam.rtsp_url_hd)
            if ok:
                registered += 1
        if paths["sd"] and cam.rtsp_url_sd:
            ok = await mediamtx_service.add_path(paths["sd"], cam.rtsp_url_sd)
            if ok:
                registered += 1

    print(f"[INFO] Synced {registered} camera stream(s) to MediaMTX")


# ── Lifespan (startup / shutdown) ─────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup: Create tables, sync MediaMTX, init MinIO, start recording.
    Shutdown: Stop recording, dispose engine.
    """
    # ── Startup ───────────────────────────────────────────────
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("[INFO] Database tables created / verified")

    # Sync tất cả camera lên MediaMTX
    await _sync_cameras_to_mediamtx()

    # Init MinIO buckets
    try:
        minio_service.init_buckets()
        print("[INFO] MinIO buckets initialized")
    except Exception as e:
        print(f"[WARN] MinIO init failed (is MinIO running?): {e}")

    # Start recording pipeline
    try:
        await recording_manager.start_all()
        print("[INFO] Recording manager started")
    except Exception as e:
        print(f"[WARN] Recording manager failed to start: {e}")

    # Start AI worker pipeline
    try:
        await ai_worker_manager.start_all()
        print("[INFO] AI worker manager started")
    except Exception as e:
        print(f"[WARN] AI worker manager failed to start: {e}")

    # Start cleanup task
    cleanup_task.start()
    print("[INFO] Cleanup task started")

    # Start health check task
    health_check_task.start()
    print("[INFO] Health check task started")

    yield

    # ── Shutdown ──────────────────────────────────────────────
    health_check_task.stop()
    cleanup_task.stop()
    await ai_worker_manager.stop_all()
    await recording_manager.stop_all()
    await engine.dispose()
    print("[INFO] Shutdown complete")



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
app.include_router(recordings.router)
app.include_router(websockets.router)
app.include_router(events.router)
app.include_router(clips.router)
app.include_router(system.router)
app.include_router(notifications.router)


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
