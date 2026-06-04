"""
Notification Service using WebSockets.
Manages active WebSocket connections and broadcasts AI events to users who have access.
"""

import json
import logging
from uuid import UUID
from fastapi import WebSocket
from sqlalchemy import select

from database import async_session
from models.user import User, UserRole
from models.user_camera_access import UserCameraAccess
from models.notification import Notification

logger = logging.getLogger(__name__)

class NotificationManager:
    def __init__(self):
        # Map user_id to a list of active WebSockets
        self.active_connections: dict[UUID, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: UUID):
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        logger.info(f"[WS] User {user_id} connected. Total WS for user: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: UUID):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"[WS] User {user_id} disconnected.")

    async def broadcast_event(self, event_data: dict):
        """
        Gửi event (dạng dict) tới những user có quyền truy cập camera_id.
        """
        camera_id = event_data.get("camera_id")
        if not camera_id:
            return

        # Tìm những user có quyền xem camera này
        allowed_user_ids = set()
        async with async_session() as db:
            # Admins always have access
            result = await db.execute(select(User.id).where(User.role == UserRole.admin))
            for row in result.all():
                allowed_user_ids.add(row[0])
            
            # Viewers with explicit access
            if isinstance(camera_id, str):
                import uuid
                try:
                    camera_uuid = uuid.UUID(camera_id)
                except ValueError:
                    return
            else:
                camera_uuid = camera_id

            access_result = await db.execute(
                select(UserCameraAccess.user_id).where(UserCameraAccess.camera_id == camera_uuid)
            )
            for row in access_result.all():
                allowed_user_ids.add(row[0])

            # Save Notification to DB for each allowed user
            event_id_str = event_data.get("id")
            if event_id_str:
                import uuid
                try:
                    event_uuid = uuid.UUID(event_id_str)
                    for uid in allowed_user_ids:
                        db.add(Notification(user_id=uid, event_id=event_uuid))
                    await db.commit()
                    
                    # Clean up old notifications per user (keep max 50)
                    # We can do this efficiently but for simplicity, we do it via row_number or just limit
                    # Alternatively, since API limits to 50, we don't strictly *need* to hard delete them immediately 
                    # but the user requested: "số lượng thông báo tối đa lưu trữ bạn hãy để là 50 thôi"
                    # So we should delete older ones.
                    for uid in allowed_user_ids:
                        # Find 50th newest notification
                        from sqlalchemy import desc
                        notifs = (await db.execute(
                            select(Notification.created_at)
                            .where(Notification.user_id == uid)
                            .order_by(desc(Notification.created_at))
                            .offset(49)
                            .limit(1)
                        )).scalar_one_or_none()
                        
                        if notifs:
                            from sqlalchemy import delete
                            await db.execute(
                                delete(Notification)
                                .where(Notification.user_id == uid, Notification.created_at < notifs)
                            )
                    await db.commit()
                except Exception as e:
                    logger.error(f"[WS] Failed to save notifications: {e}")

        # Push tới những user đang online và nằm trong danh sách được phép
        message = json.dumps(event_data)
        for u_id, websockets in self.active_connections.items():
            if u_id in allowed_user_ids:
                for ws in websockets:
                    try:
                        await ws.send_text(message)
                    except Exception as e:
                        logger.warning(f"[WS] Failed to send message to {u_id}: {e}")

notification_manager = NotificationManager()
