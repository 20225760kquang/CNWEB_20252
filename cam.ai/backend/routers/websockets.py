"""
WebSocket router for real-time notifications.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError

from config import settings
from services.notification_service import notification_manager
from uuid import UUID
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ws", tags=["WebSockets"])

async def get_user_id_from_token(token: str) -> UUID | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            return None
        import uuid
        return uuid.UUID(user_id_str)
    except JWTError:
        return None

@router.websocket("/notifications")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    """
    WebSocket endpoint for real-time AI event notifications.
    Clients must pass JWT token in query: ?token=...
    """
    await websocket.accept()
    
    user_id = await get_user_id_from_token(token)
    if not user_id:
        logger.warning("[WS] Rejected connection: Invalid or expired token")
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    logger.info(f"[WS] Valid connection attempt for user: {user_id}")
    await notification_manager.connect(websocket, user_id)
    try:
        while True:
            # We don't expect messages from client for now, just keep connection open
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        notification_manager.disconnect(websocket, user_id)
    except Exception as e:
        logger.warning(f"[WS] Connection error: {e}")
        notification_manager.disconnect(websocket, user_id)
