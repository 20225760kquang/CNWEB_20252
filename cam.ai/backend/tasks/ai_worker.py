"""
Background task for AI Video Analytics.
Reads RTSP stream, runs YOLOv8 inference, saves events & notifies via WebSocket.
"""

import asyncio
import logging
import cv2
import time
import uuid
import numpy as np
import os
import threading
from datetime import datetime, timezone
from ultralytics import YOLO

# Force OpenCV to use TCP for RTSP
os.environ["OPENCV_FFMPEG_CAPTURE_OPTIONS"] = "rtsp_transport;tcp"

from sqlalchemy.ext.asyncio import AsyncSession
from database import async_session
from models.camera import Camera, CameraStatus
from models.event import Event, EventType
from services.minio_service import minio_service
from services.notification_service import notification_manager
from config import settings

logger = logging.getLogger(__name__)

class AIWorkerManager:
    def __init__(self):
        self.active_tasks: dict[uuid.UUID, asyncio.Task] = {}
        self.stop_events: dict[uuid.UUID, threading.Event] = {}
        # Load YOLO model once
        try:
            self.model = YOLO("yolov8n.pt")  # Will download on first run
            logger.info("[AI] YOLOv8n model loaded successfully.")
        except Exception as e:
            logger.error(f"[AI] Failed to load YOLO model: {e}")
            self.model = None

    async def start_all(self):
        """Start AI worker for all cameras with ai_enabled=True"""
        if not self.model:
            return
            
        async with async_session() as db:
            from sqlalchemy import select
            cameras = (
                await db.execute(select(Camera).where(Camera.ai_enabled == True))
            ).scalars().all()

        for cam in cameras:
            await self.start_camera(cam)

    async def start_camera(self, camera: Camera):
        if camera.id in self.active_tasks:
            logger.info(f"[AI] Worker for camera {camera.id} already running.")
            return

        # Prefer SD stream for AI
        stream_url = camera.rtsp_url_sd if camera.rtsp_url_sd else camera.rtsp_url_hd
        
        # Rewrite to localhost MediaMTX if needed
        # Just use MediaMTX internal URL
        cam_id_12 = camera.id.hex[:12]
        mtx_url = f"rtsp://127.0.0.1:8554/cam_{cam_id_12}_sd"
        if not camera.rtsp_url_sd:
            mtx_url = f"rtsp://127.0.0.1:8554/cam_{cam_id_12}_hd"

        stop_event = threading.Event()
        self.stop_events[camera.id] = stop_event

        task = asyncio.create_task(self._process_stream(camera.id, camera.name, mtx_url, stop_event))
        self.active_tasks[camera.id] = task
        logger.info(f"[AI] Started AI worker for camera {camera.name}")

    async def stop_camera(self, camera_id: uuid.UUID):
        if camera_id in self.stop_events:
            self.stop_events[camera_id].set()
            del self.stop_events[camera_id]
            
        if camera_id in self.active_tasks:
            self.active_tasks[camera_id].cancel()
            del self.active_tasks[camera_id]
            logger.info(f"[AI] Stopped AI worker for camera {camera_id}")

    async def stop_all(self):
        for cam_id in list(self.active_tasks.keys()):
            await self.stop_camera(cam_id)

    async def _process_stream(self, camera_id: uuid.UUID, camera_name: str, stream_url: str, stop_event: threading.Event):
        # We run OpenCV in a thread to not block asyncio
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, self._run_inference_loop, camera_id, camera_name, stream_url, loop, stop_event)

    def _run_inference_loop(self, camera_id: uuid.UUID, camera_name: str, stream_url: str, loop: asyncio.AbstractEventLoop, stop_event: threading.Event):
        """
        Runs in a separate thread.
        Reads frames from RTSP, runs YOLO inference, triggers events.
        """
        cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)
        if not cap.isOpened():
            logger.error(f"[AI] Failed to open stream for camera {camera_id}")
            return

        # Set buffer size small
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
        
        last_process_time = 0
        last_event_time = 0
        COOLDOWN_SECONDS = 10 # Only trigger event every 10 seconds per camera

        try:
            while not stop_event.is_set():
                # To prevent buffer lag, we grab continuously
                ret = cap.grab()
                if not ret:
                    if stop_event.is_set():
                        break
                    logger.warning(f"[AI] Lost connection to {stream_url}. Retrying...")
                    # Delay before retry to avoid CPU spinning
                    for _ in range(20):
                        if stop_event.is_set():
                            break
                        time.sleep(0.1)
                    if stop_event.is_set():
                        break
                    cap.release()
                    cap = cv2.VideoCapture(stream_url, cv2.CAP_FFMPEG)
                    cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)
                    continue

                now = time.time()
                # Process at ~1 FPS
                if now - last_process_time >= 1.0:
                    ret, frame = cap.retrieve()
                    if not ret:
                        continue
                        
                    last_process_time = now

                    # Run YOLO
                    # classes=[0] means only detect person
                    results = self.model(frame, classes=[0], conf=0.5, verbose=False)
                    
                    person_detected = False
                    for r in results:
                        if len(r.boxes) > 0:
                            person_detected = True
                            break

                    if person_detected and (now - last_event_time >= COOLDOWN_SECONDS):
                        last_event_time = now
                        logger.info(f"[AI] Person detected on camera {camera_name}!")
                        
                        # Save frame
                        # Optionally draw bounding boxes
                        annotated_frame = results[0].plot()
                        _, buffer = cv2.imencode('.jpg', annotated_frame)
                        
                        asyncio.run_coroutine_threadsafe(
                            self._handle_detection(camera_id, camera_name, buffer.tobytes()), 
                            loop
                        )
                        
        except Exception as e:
            logger.error(f"[AI] Worker loop error for {camera_id}: {e}")
        finally:
            cap.release()
            logger.info(f"[AI] Worker stopped for {camera_id}")

    async def _handle_detection(self, camera_id: uuid.UUID, camera_name: str, image_bytes: bytes):
        try:
            # 1. Upload to MinIO
            timestamp = datetime.now(timezone.utc)
            timestamp_str = timestamp.strftime("%Y-%m-%d_%H-%M-%S")
            object_name = f"events/{camera_id.hex}/{timestamp_str}.jpg"
            
            minio_service.upload_bytes(
                bucket=settings.MINIO_BUCKET_RECORDINGS,
                object_name=object_name,
                data=image_bytes,
                content_type="image/jpeg"
            )

            # 2. Insert to DB
            async with async_session() as db:
                event = Event(
                    camera_id=camera_id,
                    event_type=EventType.person_detected,
                    snapshot_minio_key=object_name,
                )
                db.add(event)
                await db.commit()
                await db.refresh(event)

            # 3. Get Presigned URL
            snapshot_url = minio_service.get_presigned_url(
                bucket=settings.MINIO_BUCKET_RECORDINGS,
                object_name=object_name,
                expires_seconds=3600
            )

            # 4. Broadcast via WebSocket
            event_data = {
                "id": str(event.id),
                "camera_id": str(camera_id),
                "camera_name": camera_name,
                "event_type": event.event_type.value,
                "created_at": event.created_at.isoformat(),
                "snapshot_url": snapshot_url
            }
            await notification_manager.broadcast_event(event_data)

        except Exception as e:
            logger.error(f"[AI] Handle detection error: {e}")

ai_worker_manager = AIWorkerManager()
