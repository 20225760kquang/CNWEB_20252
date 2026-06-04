"""
Background task for checking camera health.
Pings the RTSP port of each camera every 90 seconds.
"""

import asyncio
import logging
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

async def check_rtsp_alive(rtsp_url: str) -> bool:
    if not rtsp_url:
        return False
    try:
        parsed = urlparse(rtsp_url)
        host = parsed.hostname
        port = parsed.port or 554
        if not host:
            return False
        
        # Thử mở kết nối TCP đến port RTSP
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), 
            timeout=3.0
        )
        writer.close()
        await writer.wait_closed()
        return True
    except Exception:
        return False


class HealthCheckTask:
    def __init__(self):
        self._task: asyncio.Task | None = None
        self._running = False

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._health_check_loop())
        logger.info("[HEALTH_CHECK] Task started (every 90s)")

    def stop(self):
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("[HEALTH_CHECK] Task stopped")

    async def _health_check_loop(self):
        try:
            while self._running:
                await self.run_check()
                await asyncio.sleep(90)
        except asyncio.CancelledError:
            pass

    async def run_check(self):
        from database import async_session
        from models.camera import Camera, CameraStatus
        from sqlalchemy import select

        try:
            async with async_session() as db:
                result = await db.execute(select(Camera))
                cameras = result.scalars().all()

                for cam in cameras:
                    is_alive = await check_rtsp_alive(cam.rtsp_url_hd)
                    new_status = CameraStatus.online if is_alive else CameraStatus.offline
                    
                    if cam.status != new_status:
                        cam.status = new_status
                        logger.info(f"[HEALTH_CHECK] Camera {cam.name} status changed to {new_status.value}")
                        
                        if new_status == CameraStatus.offline:
                            from models.event import Event, EventType
                            db.add(Event(camera_id=cam.id, event_type=EventType.camera_offline))

                await db.commit()
        except Exception as e:
            logger.error(f"[HEALTH_CHECK] Error: {e}")


# Singleton instance
health_check_task = HealthCheckTask()
