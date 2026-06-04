"""
Services package.
"""

from services.minio_service import minio_service
from services.mediamtx_service import mediamtx_service

__all__ = ["minio_service", "mediamtx_service"]
