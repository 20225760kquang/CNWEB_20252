"""
Notifications Router
GET /api/notifications - Get user notifications (max 50)
PUT /api/notifications/{id}/read - Mark specific notification as read
PUT /api/notifications/read-all - Mark all notifications as read
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, desc, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from uuid import UUID
from datetime import timezone

from database import get_db
from models.user import User
from models.notification import Notification
from models.event import Event
from middleware.auth import get_current_active_user

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


@router.get("")
async def get_notifications(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get latest 50 notifications for the current user."""
    # Count unread
    unread_count = (
        await db.execute(
            select(Notification.id)
            .where(Notification.user_id == current_user.id, Notification.is_read == False)
        )
    ).all()
    
    # Get 50 recent
    query = (
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .options(joinedload(Notification.event).joinedload(Event.camera))
        .order_by(desc(Notification.created_at))
        .limit(50)
    )
    result = await db.execute(query)
    notifications = result.scalars().all()

    formatted_notifs = []
    for notif in notifications:
        ev = notif.event
        camera_name = ev.camera.name if ev and ev.camera else "Unknown"
        camera_location = ev.camera.location if ev and ev.camera else ""
        
        event_text = "Sự kiện"
        if ev:
            if ev.event_type.value == "person_detected":
                event_text = "Phát hiện có người"
            elif ev.event_type.value == "camera_offline":
                event_text = "Mất kết nối"

        formatted_notifs.append({
            "id": str(notif.id),
            "event_id": str(notif.event_id),
            "camera_name": camera_name,
            "camera_location": camera_location,
            "event_text": event_text,
            "is_read": notif.is_read,
            "created_at": notif.created_at.isoformat() if notif.created_at else None,
        })

    return {
        "unread_count": len(unread_count),
        "notifications": formatted_notifs
    }


@router.put("/read-all")
async def mark_all_as_read(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark all notifications as read for current user."""
    await db.execute(
        update(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}


@router.put("/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a specific notification as read."""
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == current_user.id
        )
    )
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")

    notif.is_read = True
    await db.commit()
    return {"message": "Notification marked as read"}
