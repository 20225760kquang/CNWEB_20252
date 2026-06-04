"""
MinIO S3-compatible storage service.
Handles upload, download, presigned URL generation, and object management.
"""

import io
import logging
from datetime import timedelta
from pathlib import Path

from minio import Minio
from minio.error import S3Error

from config import settings

logger = logging.getLogger(__name__)


class MinIOService:
    """Singleton service for MinIO operations."""

    def __init__(self):
        self.client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )

    # ── Bucket Management ─────────────────────────────────────

    def init_buckets(self):
        """Create required buckets if they don't exist."""
        for bucket_name in [
            settings.MINIO_BUCKET_RECORDINGS,
            settings.MINIO_BUCKET_SNAPSHOTS,
        ]:
            try:
                if not self.client.bucket_exists(bucket_name):
                    self.client.make_bucket(bucket_name)
                    logger.info(f"Created MinIO bucket: {bucket_name}")
                else:
                    logger.info(f"MinIO bucket already exists: {bucket_name}")
            except S3Error as e:
                logger.error(f"Failed to create bucket '{bucket_name}': {e}")
                raise

    # ── Upload Operations ─────────────────────────────────────

    def upload_file(
        self, bucket: str, object_name: str, file_path: str,
        content_type: str = "application/octet-stream",
    ) -> bool:
        """Upload a local file to MinIO."""
        try:
            self.client.fput_object(
                bucket, object_name, file_path,
                content_type=content_type,
            )
            return True
        except S3Error as e:
            logger.error(f"Upload failed {object_name}: {e}")
            return False

    def upload_bytes(
        self, bucket: str, object_name: str, data: bytes,
        content_type: str = "application/octet-stream",
    ) -> bool:
        """Upload raw bytes to MinIO."""
        try:
            stream = io.BytesIO(data)
            self.client.put_object(
                bucket, object_name, stream, length=len(data),
                content_type=content_type,
            )
            return True
        except S3Error as e:
            logger.error(f"Upload bytes failed {object_name}: {e}")
            return False

    # ── Download / Read Operations ────────────────────────────

    def get_object_content(self, bucket: str, object_name: str) -> str | None:
        """Read object content as UTF-8 string (for .m3u8 playlists)."""
        try:
            response = self.client.get_object(bucket, object_name)
            content = response.read().decode("utf-8")
            response.close()
            response.release_conn()
            return content
        except S3Error as e:
            logger.error(f"Failed to read {object_name}: {e}")
            return None

    def get_object_bytes(self, bucket: str, object_name: str) -> bytes | None:
        """Read object content as raw bytes."""
        try:
            response = self.client.get_object(bucket, object_name)
            data = response.read()
            response.close()
            response.release_conn()
            return data
        except S3Error as e:
            logger.error(f"Failed to read bytes {object_name}: {e}")
            return None

    # ── Presigned URLs ────────────────────────────────────────

    def get_presigned_url(
        self, bucket: str, object_name: str, expires_seconds: int = 3600,
    ) -> str | None:
        """Generate a presigned GET URL for direct browser access."""
        try:
            url = self.client.presigned_get_object(
                bucket, object_name,
                expires=timedelta(seconds=expires_seconds),
            )
            return url
        except S3Error as e:
            logger.error(f"Presigned URL failed {object_name}: {e}")
            return None

    # ── List & Delete Operations ──────────────────────────────

    def list_objects(
        self, bucket: str, prefix: str = "", recursive: bool = True,
    ) -> list[str]:
        """List object names under a prefix."""
        try:
            objects = self.client.list_objects(
                bucket, prefix=prefix, recursive=recursive,
            )
            return [obj.object_name for obj in objects]
        except S3Error as e:
            logger.error(f"List objects failed prefix={prefix}: {e}")
            return []

    def delete_object(self, bucket: str, object_name: str) -> bool:
        """Delete a single object."""
        try:
            self.client.remove_object(bucket, object_name)
            return True
        except S3Error as e:
            logger.error(f"Delete failed {object_name}: {e}")
            return False

    def delete_objects_by_prefix(self, bucket: str, prefix: str) -> int:
        """Delete all objects under a prefix. Returns count deleted."""
        objects = self.list_objects(bucket, prefix=prefix)
        deleted = 0
        for obj_name in objects:
            if self.delete_object(bucket, obj_name):
                deleted += 1
        logger.info(f"Deleted {deleted} objects with prefix '{prefix}'")
        return deleted

    # ── Utility ───────────────────────────────────────────────

    def object_exists(self, bucket: str, object_name: str) -> bool:
        """Check if an object exists."""
        try:
            self.client.stat_object(bucket, object_name)
            return True
        except S3Error:
            return False


# Singleton instance
minio_service = MinIOService()
