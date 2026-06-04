"""
Cleanup task — periodically removes expired recordings.

Runs every 30 minutes:
1. Finds recordings older than RECORDING_RETENTION_HOURS
2. Deletes their segments from MinIO
3. Deletes local temp files
4. Updates recording status to 'expired' in PostgreSQL

Also cleans up local segments that have been successfully synced to MinIO
to free disk space.
"""

import asyncio
import logging
import os
import shutil
from datetime import datetime, timedelta, timezone

from config import settings

logger = logging.getLogger(__name__)


class CleanupTask:
    """Periodic background task for data retention."""

    def __init__(self):
        self._task: asyncio.Task | None = None
        self._running = False

    def start(self):
        """Start the cleanup loop."""
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._cleanup_loop())
        logger.info("[CLEANUP] Cleanup task started (every 30 min)")

    def stop(self):
        """Stop the cleanup loop."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("[CLEANUP] Cleanup task stopped")

    async def _cleanup_loop(self):
        """Main loop — run cleanup every 30 minutes."""
        try:
            while self._running:
                await asyncio.sleep(30 * 60)  # 30 minutes
                await self.run_cleanup()
        except asyncio.CancelledError:
            pass

    async def run_cleanup(self):
        """Execute one round of cleanup."""
        logger.info("[CLEANUP] Running cleanup...")

        try:
            expired_count = await self._expire_old_recordings()
            cleaned_local = self._cleanup_local_synced_segments()

            logger.info(
                f"[CLEANUP] Done — "
                f"expired {expired_count} recording(s), "
                f"cleaned {cleaned_local} local dir(s)"
            )
        except Exception as e:
            logger.error(f"[CLEANUP] Error during cleanup: {e}")

    async def _expire_old_recordings(self) -> int:
        """
        Find recordings older than retention period,
        delete from MinIO, mark as expired in DB.
        """
        from database import async_session
        from models.recording import Recording, RecordingStatus
        from services.minio_service import minio_service
        from sqlalchemy import select

        cutoff = datetime.now(timezone.utc) - timedelta(
            hours=settings.RECORDING_RETENTION_HOURS
        )

        async with async_session() as db:
            # Find non-expired recordings older than cutoff
            result = await db.execute(
                select(Recording).where(
                    Recording.start_time < cutoff,
                    Recording.status != RecordingStatus.expired,
                )
            )
            old_recordings = result.scalars().all()

            if not old_recordings:
                return 0

            count = 0
            for rec in old_recordings:
                # 1. Delete segments from MinIO
                prefix = rec.minio_playlist_key.rsplit("/", 1)[0]
                minio_service.delete_objects_by_prefix(
                    rec.minio_bucket, prefix + "/"
                )

                # 2. Delete local temp directory
                cam_dir = os.path.join(
                    settings.RECORDING_LOCAL_DIR,
                    str(rec.camera_id),
                    prefix.split("/", 1)[-1] if "/" in prefix else prefix,
                )
                if os.path.isdir(cam_dir):
                    shutil.rmtree(cam_dir, ignore_errors=True)

                # 3. Update status in DB
                rec.status = RecordingStatus.expired
                count += 1

            await db.commit()

        return count

    def _cleanup_local_synced_segments(self) -> int:
        """
        Delete local .ts segments that have already been uploaded to MinIO.
        Keeps index.m3u8 locally (needed by FFmpeg if still recording).
        Only cleans completed sessions (no active FFmpeg writing to them).
        """
        from services.minio_service import minio_service
        from tasks.recorder import recording_manager

        local_dir = settings.RECORDING_LOCAL_DIR
        if not os.path.isdir(local_dir):
            return 0

        # Get active session directories to avoid cleaning them
        active_dirs = set()
        for recorder in recording_manager.recorders.values():
            if recorder._current_session_dir:
                active_dirs.add(
                    os.path.normpath(recorder._current_session_dir)
                )

        cleaned = 0
        bucket = settings.MINIO_BUCKET_RECORDINGS

        for cam_dir_name in os.listdir(local_dir):
            cam_path = os.path.join(local_dir, cam_dir_name)
            if not os.path.isdir(cam_path):
                continue

            for session_dir_name in os.listdir(cam_path):
                session_path = os.path.join(cam_path, session_dir_name)
                if not os.path.isdir(session_path):
                    continue

                # Skip active recording directories
                if os.path.normpath(session_path) in active_dirs:
                    continue

                # This is a completed session — safe to clean local .ts files
                for filename in os.listdir(session_path):
                    if not filename.endswith(".ts"):
                        continue

                    local_file = os.path.join(session_path, filename)
                    minio_key = f"{cam_dir_name}/{session_dir_name}/{filename}"

                    # Only delete local if confirmed on MinIO
                    if minio_service.object_exists(bucket, minio_key):
                        os.remove(local_file)

                # If directory only has index.m3u8 left (or is empty),
                # remove the whole directory
                remaining = os.listdir(session_path)
                if not remaining:
                    shutil.rmtree(session_path, ignore_errors=True)
                    cleaned += 1

        return cleaned


# Singleton instance
cleanup_task = CleanupTask()
