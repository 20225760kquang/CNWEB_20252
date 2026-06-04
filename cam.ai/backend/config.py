"""
Application configuration using pydantic-settings.
Loads from .env file automatically.
"""

from pydantic_settings import BaseSettings
from typing import List
import json


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://postgres:1@localhost:5432/vms_db"

    # ── JWT ───────────────────────────────────────────────────
    JWT_SECRET_KEY: str = "cec1f00e68723a1a383b1eaa127f81c285788abca0e76f7152cbc95391eb7dbb"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ── CORS ──────────────────────────────────────────────────
    CORS_ORIGINS: str = '["http://localhost:5500","http://127.0.0.1:5500"]'

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS JSON string into a list."""
        return json.loads(self.CORS_ORIGINS)

    # ── MinIO (Sprint 3+) ────────────────────────────────────
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_RECORDINGS: str = "recordings"
    MINIO_BUCKET_SNAPSHOTS: str = "snapshots"

    MINIO_SECURE: bool = False  # True nếu MinIO dùng HTTPS

    # ── MediaMTX (Sprint 2+) ─────────────────────────────────
    MEDIAMTX_API_URL: str = "http://localhost:9997"
    MEDIAMTX_WEBRTC_URL: str = "http://localhost:8889"

    # ── Recording Pipeline (Sprint 3) ────────────────────────
    RECORDING_LOCAL_DIR: str = "./recordings_temp"
    RECORDING_SEGMENT_DURATION: int = 10         # giây / segment
    RECORDING_RETENTION_HOURS: int = 6           # xóa data cũ hơn 6h
    RECORDING_ROTATE_MINUTES: int = 60           # tạo recording mới mỗi 1h
    RECORDING_SYNC_INTERVAL: int = 10            # sync lên MinIO mỗi 10 giây

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }


# Singleton instance
settings = Settings()
