"""
FFmpeg HLS Recording Pipeline.

Manages FFmpeg subprocesses that record RTSP streams into HLS segments (.ts),
and a background sync task that uploads those segments to MinIO.

Flow:
  Camera (RTSP) → MediaMTX → FFmpeg subprocess → local .ts/.m3u8
                                                      ↓
                                          Sync task → MinIO bucket

Each camera with recording_enabled=True gets its own FFmpeg process.
Recordings are rotated every RECORDING_ROTATE_MINUTES (default 60 min).
"""

import asyncio
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from config import settings

logger = logging.getLogger(__name__)


class CameraRecorder:
    """Manages a single FFmpeg recording process for one camera."""

    def __init__(
        self, camera_id: UUID, camera_name: str,
        rtsp_url: str, mtx_path_hd: str,
    ):
        self.camera_id = camera_id
        self.camera_name = camera_name
        self.rtsp_url = rtsp_url
        self.mtx_path_hd = mtx_path_hd

        # Nhóm điều khiển tiến trình FFmpeg và tác vụ ngầm 
        self.process: asyncio.subprocess.Process | None = None
        self.recording_id: UUID | None = None
        self.is_running = False
        self._stop_event = asyncio.Event()
        self._task: asyncio.Task | None = None

        self._current_session_dir: str = ""
        self._current_minio_prefix: str = ""

    def _get_session_paths(self) -> tuple[str, str]:
        """Generate local dir and MinIO prefix for current session."""
        now = datetime.now(timezone.utc)
        session_name = now.strftime("%Y-%m-%d_%H-%M")
        cam_id_str = str(self.camera_id)

        local_dir = os.path.join(
            settings.RECORDING_LOCAL_DIR, cam_id_str, session_name,
        )
        minio_prefix = f"{cam_id_str}/{session_name}"

        return local_dir, minio_prefix

    async def start(self):
        """Start the recording loop (FFmpeg + sync)."""
        if self.is_running:
            logger.warning(f"Recorder for {self.camera_name} already running")
            return

        self.is_running = True
        self._stop_event.clear()
        self._task = asyncio.create_task(self._recording_loop())
        logger.info(f"[REC] Started recorder for camera: {self.camera_name}")

    async def stop(self):
        """Stop recording gracefully."""
        if not self.is_running:
            return

        self.is_running = False
        self._stop_event.set()

        # Kill FFmpeg process
        if self.process and self.process.returncode is None:
            try:
                self.process.terminate()
                await asyncio.wait_for(self.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                self.process.kill()
                await self.process.wait()

        # Cancel the task
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

        # Final sync before stopping
        await self._sync_to_minio()

        # Update recording in DB
        await self._finalize_recording()

        logger.info(f"[REC] Stopped recorder for camera: {self.camera_name}")

    async def _recording_loop(self):
        """Main loop: run FFmpeg, sync to MinIO, handle rotation."""
        retry_count = 0
        max_retries = 5

        while self.is_running and not self._stop_event.is_set():
            try:
                # Create new session
                self._current_session_dir, self._current_minio_prefix = (
                    self._get_session_paths()
                )
                os.makedirs(self._current_session_dir, exist_ok=True)

                # Create recording record in DB
                await self._create_recording_record()

                # Start FFmpeg
                await self._run_ffmpeg()

                # Start sync task in parallel
                sync_task = asyncio.create_task(self._sync_loop())

                # Wait for rotation interval or stop
                try:
                    await asyncio.wait_for(
                        self._stop_event.wait(),
                        timeout=settings.RECORDING_ROTATE_MINUTES * 60,
                    )
                    # If we get here, stop was requested
                    break
                except asyncio.TimeoutError:
                    # Rotation time — stop current, start new
                    pass

                # Stop FFmpeg for rotation
                if self.process and self.process.returncode is None:
                    self.process.terminate()
                    try:
                        await asyncio.wait_for(self.process.wait(), timeout=5)
                    except asyncio.TimeoutError:
                        self.process.kill()
                        await self.process.wait()

                # Stop sync and do final sync
                sync_task.cancel()
                try:
                    await sync_task
                except asyncio.CancelledError:
                    pass
                await self._sync_to_minio()

                # Finalize current recording
                await self._finalize_recording()

                retry_count = 0  # Reset on successful rotation

            except Exception as e:
                retry_count += 1
                logger.error(
                    f"[REC] Error recording {self.camera_name} "
                    f"(attempt {retry_count}/{max_retries}): {repr(e)}"
                )
                if retry_count >= max_retries:
                    logger.error(
                        f"[REC] Max retries reached for {self.camera_name}, "
                        f"marking camera as error"
                    )
                    await self._update_camera_status("error")
                    break

                await asyncio.sleep(5)  # Wait before retry

    async def _run_ffmpeg(self):
        """Start FFmpeg subprocess for HLS recording."""
        # Build the RTSP source URL via MediaMTX
        rtsp_source = f"rtsp://127.0.0.1:8554/{self.mtx_path_hd}"

        segment_pattern = os.path.join(
            self._current_session_dir, "seg_%05d.ts"
        )
        playlist_path = os.path.join(
            self._current_session_dir, "index.m3u8"
        )

        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel", "warning",
            "-rtsp_transport", "tcp",
            "-i", rtsp_source,
            "-c:v", "libx264",      # Transcode to H.264 for browser compatibility
            "-preset", "ultrafast", # Minimize CPU usage
            "-crf", "28",           # Acceptable quality/size trade-off
            "-an",                  # Drop audio
            "-f", "hls",
            "-hls_time", str(settings.RECORDING_SEGMENT_DURATION),
            "-hls_list_size", "0",  # Keep all segments in playlist
            "-hls_flags", "append_list",
            "-hls_segment_filename", segment_pattern,
            playlist_path,
        ]

        logger.info(
            f"[REC] Starting FFmpeg for {self.camera_name}: "
            f"{rtsp_source} → {self._current_session_dir}"
        )

        self.process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        # Monitor FFmpeg stderr in background (for error detection)
        asyncio.create_task(self._monitor_ffmpeg_output())

    async def _monitor_ffmpeg_output(self):
        """Read FFmpeg stderr to detect errors."""
        if not self.process or not self.process.stderr:
            return

        try:
            async for line in self.process.stderr:
                text = line.decode("utf-8", errors="replace").strip()
                if text:
                    # Only log warnings/errors, skip info noise
                    if any(kw in text.lower() for kw in [
                        "error", "fail", "refused", "timeout",
                        "broken", "no route",
                    ]):
                        logger.warning(f"[FFmpeg:{self.camera_name}] {text}")
        except Exception:
            pass

    async def _sync_loop(self):
        """Periodically sync local segments to MinIO."""
        try:
            while self.is_running and not self._stop_event.is_set():
                await asyncio.sleep(settings.RECORDING_SYNC_INTERVAL)
                await self._sync_to_minio()
        except asyncio.CancelledError:
            pass

    async def _sync_to_minio(self):
        """Upload new local segments and playlist to MinIO."""
        from services.minio_service import minio_service

        if not os.path.isdir(self._current_session_dir):
            return

        bucket = settings.MINIO_BUCKET_RECORDINGS
        synced = 0

        for filename in sorted(os.listdir(self._current_session_dir)):
            local_path = os.path.join(self._current_session_dir, filename)
            if not os.path.isfile(local_path):
                continue

            minio_key = f"{self._current_minio_prefix}/{filename}"

            if filename.endswith(".ts"):
                # Only upload .ts files once (check by existence)
                if not minio_service.object_exists(bucket, minio_key):
                    content_type = "video/mp2t"
                    ok = minio_service.upload_file(
                        bucket, minio_key, local_path,
                        content_type=content_type,
                    )
                    if ok:
                        synced += 1
            elif filename == "index.m3u8":
                # Always re-upload the playlist (it gets updated by FFmpeg)
                ok = minio_service.upload_file(
                    bucket, minio_key, local_path,
                    content_type="application/vnd.apple.mpegurl",
                )

        if synced > 0:
            logger.info(
                f"[SYNC] {self.camera_name}: uploaded {synced} new segment(s)"
            )

    async def _create_recording_record(self):
        """Insert a new recording row in PostgreSQL."""
        from database import async_session
        from models.recording import Recording, RecordingStatus

        minio_key = f"{self._current_minio_prefix}/index.m3u8"

        async with async_session() as db:
            recording = Recording(
                camera_id=self.camera_id,
                start_time=datetime.now(timezone.utc),
                minio_bucket=settings.MINIO_BUCKET_RECORDINGS,
                minio_playlist_key=minio_key,
                status=RecordingStatus.recording,
            )
            db.add(recording)
            await db.commit()
            await db.refresh(recording)
            self.recording_id = recording.id

        logger.info(
            f"[REC] Created recording {self.recording_id} "
            f"for {self.camera_name}"
        )

    async def _finalize_recording(self):
        """Update recording end_time and status to completed."""
        if not self.recording_id:
            return

        from database import async_session
        from models.recording import Recording, RecordingStatus
        from sqlalchemy import select

        async with async_session() as db:
            result = await db.execute(
                select(Recording).where(Recording.id == self.recording_id)
            )
            recording = result.scalar_one_or_none()
            if recording and recording.status == RecordingStatus.recording:
                recording.end_time = datetime.now(timezone.utc)
                recording.status = RecordingStatus.completed

                # Calculate duration
                if recording.start_time:
                    delta = recording.end_time - recording.start_time
                    recording.duration_seconds = int(delta.total_seconds())

                # Calculate total file size from local segments
                if os.path.isdir(self._current_session_dir):
                    total_bytes = sum(
                        os.path.getsize(os.path.join(
                            self._current_session_dir, f
                        ))
                        for f in os.listdir(self._current_session_dir)
                        if f.endswith(".ts")
                    )
                    recording.file_size_bytes = total_bytes

                await db.commit()

        logger.info(
            f"[REC] Finalized recording {self.recording_id} "
            f"for {self.camera_name}"
        )
        self.recording_id = None

    async def _update_camera_status(self, new_status: str):
        """Update camera status in DB (e.g., to 'error' on max retries)."""
        from database import async_session
        from models.camera import Camera, CameraStatus
        from sqlalchemy import select

        async with async_session() as db:
            result = await db.execute(
                select(Camera).where(Camera.id == self.camera_id)
            )
            camera = result.scalar_one_or_none()
            if camera:
                camera.status = CameraStatus(new_status)
                await db.commit()

        logger.warning(
            f"[REC] Camera {self.camera_name} status → {new_status}"
        )


class RecordingManager:
    """
    Top-level manager that orchestrates all camera recorders.
    Integrates with FastAPI lifespan (startup/shutdown).
    """

    def __init__(self):
        self.recorders: dict[UUID, CameraRecorder] = {}

    async def start_all(self):
        """
        Start recording for all cameras with recording_enabled=True.
        Called during FastAPI startup.
        """
        from database import async_session
        from models.camera import Camera
        from models.recording import Recording, RecordingStatus
        from sqlalchemy import select
        import os
        from datetime import datetime, timezone

        async with async_session() as db:
            # 1. Cleanup orphaned recordings from previous crashed runs
            result = await db.execute(
                select(Recording).where(Recording.status == RecordingStatus.recording)
            )
            orphans = result.scalars().all()
            for orphan in orphans:
                orphan.status = RecordingStatus.completed
                
                # Estimate end_time and size from local files if possible
                total_bytes = 0
                last_modified = None
                
                if orphan.minio_playlist_key:
                    try:
                        # minio_playlist_key: "camera_id/YYYY-MM-DD_HH-MM/index.m3u8"
                        parts = orphan.minio_playlist_key.split("/")
                        if len(parts) >= 3:
                            cam_id_str = parts[0]
                            session_name = parts[1]
                            local_dir = os.path.join(settings.RECORDING_LOCAL_DIR, cam_id_str, session_name)
                            
                            if os.path.isdir(local_dir):
                                for f in os.listdir(local_dir):
                                    if f.endswith(".ts"):
                                        filepath = os.path.join(local_dir, f)
                                        total_bytes += os.path.getsize(filepath)
                                        mtime = os.path.getmtime(filepath)
                                        if not last_modified or mtime > last_modified:
                                            last_modified = mtime
                    except Exception as e:
                        logger.warning(f"Error checking local files for orphan {orphan.id}: {e}")

                # Fallback: Nếu không còn file local, đọc file index.m3u8 từ MinIO để lấy thời lượng
                if not last_modified and orphan.minio_playlist_key:
                    try:
                        from services.minio_service import minio_service
                        m3u8_content = minio_service.get_object_content(
                            settings.MINIO_BUCKET_RECORDINGS, 
                            orphan.minio_playlist_key
                        )
                        if m3u8_content:
                            # Parse duration from #EXTINF lines
                            import re
                            durations = re.findall(r"#EXTINF:([0-9.]+),", m3u8_content)
                            if durations:
                                total_duration_seconds = sum(float(d) for d in durations)
                                orphan.end_time = orphan.start_time + __import__("datetime").timedelta(seconds=total_duration_seconds)
                                total_bytes = 1 # Fake size so frontend doesn't hide it
                    except Exception as e:
                        logger.warning(f"Error checking MinIO for orphan {orphan.id}: {e}")
                
                if total_bytes > 0:
                    orphan.file_size_bytes = total_bytes
                if last_modified:
                    orphan.end_time = datetime.fromtimestamp(last_modified, tz=timezone.utc)
                elif not orphan.end_time:
                    orphan.end_time = orphan.start_time
                    
                if orphan.start_time and orphan.end_time:
                    delta = orphan.end_time - orphan.start_time
                    orphan.duration_seconds = int(delta.total_seconds())

            if orphans:
                await db.commit()
                logger.info(f"[REC] Cleaned up {len(orphans)} orphaned recording(s)")

            # 2. Start active cameras
            result = await db.execute(
                select(Camera).where(Camera.recording_enabled == True)
            )
            cameras = result.scalars().all()

        if not cameras:
            logger.info("[REC] No cameras with recording_enabled=True")
            return

        for cam in cameras:
            await self.start_camera(cam)

        logger.info(
            f"[REC] Recording manager started — "
            f"{len(self.recorders)} camera(s) recording"
        )

    async def start_camera(self, camera) -> bool:
        """Start recording for a single camera."""
        if camera.id in self.recorders:
            logger.warning(
                f"[REC] Camera {camera.name} already has an active recorder"
            )
            return False

        # Build MediaMTX path name (same logic as cameras router)
        cam_id_short = str(camera.id).replace("-", "")[:12]
        mtx_path_hd = f"cam_{cam_id_short}_hd"

        recorder = CameraRecorder(
            camera_id=camera.id,
            camera_name=camera.name,
            rtsp_url=camera.rtsp_url_hd,
            mtx_path_hd=mtx_path_hd,
        )
        self.recorders[camera.id] = recorder
        await recorder.start()
        return True

    async def stop_camera(self, camera_id: UUID) -> bool:
        """Stop recording for a single camera."""
        recorder = self.recorders.pop(camera_id, None)
        if not recorder:
            return False
        await recorder.stop()
        return True

    async def stop_all(self):
        """Stop all recorders. Called during FastAPI shutdown."""
        logger.info("[REC] Stopping all recorders...")
        tasks = []
        for cam_id in list(self.recorders.keys()):
            recorder = self.recorders.pop(cam_id)
            tasks.append(recorder.stop())

        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        logger.info("[REC] All recorders stopped")

    def get_status(self) -> dict:
        """Get current recording status for all cameras."""
        cameras = []
        for cam_id, recorder in self.recorders.items():
            cameras.append({
                "camera_id": str(cam_id),
                "camera_name": recorder.camera_name,
                "is_running": recorder.is_running,
                "recording_id": (
                    str(recorder.recording_id) if recorder.recording_id
                    else None
                ),
            })
        return {
            "active_cameras": len(self.recorders),
            "cameras": cameras,
        }


# Singleton instance
recording_manager = RecordingManager()
