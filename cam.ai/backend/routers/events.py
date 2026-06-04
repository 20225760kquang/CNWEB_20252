"""
Events router.
GET /api/events - List historical AI events.
"""

from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timezone

from database import get_db
from models.user import User, UserRole
from models.event import Event, EventType
from models.user_camera_access import UserCameraAccess
from middleware.auth import get_current_active_user
from services.minio_service import minio_service
from config import settings

router = APIRouter(prefix="/api/events", tags=["Events"])

@router.get("")
# Lấy ra thông tin các events 
async def get_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    camera_id: UUID = Query(None, description="Filter by camera ID"),
    start_time: datetime = Query(None, description="Filter from this time"),
    end_time: datetime = Query(None, description="Filter until this time"),
    event_type: str = Query(None, description="Filter by event type"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get AI events history.
    Viewer can only see events for cameras they have access to.
    """
    query = select(Event)
    count_query = select(func.count(Event.id))

    # RBAC filtering
    if current_user.role != UserRole.admin:
        # User sees only events from assigned cameras
        if camera_id:
            # check access
            access = await db.execute(
                select(UserCameraAccess).where(
                    UserCameraAccess.user_id == current_user.id,
                    UserCameraAccess.camera_id == camera_id,
                )
            )
            if not access.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="No access to this camera")
            query = query.where(Event.camera_id == camera_id)
            count_query = count_query.where(Event.camera_id == camera_id)
        else:
            # Only where camera_id in user's access list
            query = query.join(
                UserCameraAccess, UserCameraAccess.camera_id == Event.camera_id
            ).where(UserCameraAccess.user_id == current_user.id)
            count_query = count_query.join(
                UserCameraAccess, UserCameraAccess.camera_id == Event.camera_id
            ).where(UserCameraAccess.user_id == current_user.id)
    else:
        # Admin
        if camera_id:
            query = query.where(Event.camera_id == camera_id)
            count_query = count_query.where(Event.camera_id == camera_id)

    # Time filtering
    if start_time:
        st = start_time.astimezone().replace(tzinfo=None)
        query = query.where(Event.created_at >= st)
        count_query = count_query.where(Event.created_at >= st)
    if end_time:
        et = end_time.astimezone().replace(tzinfo=None)
        query = query.where(Event.created_at <= et)
        count_query = count_query.where(Event.created_at <= et)

    if event_type:
        query = query.where(Event.event_type == event_type)
        count_query = count_query.where(Event.event_type == event_type)

    # Execute count
    total = (await db.execute(count_query)).scalar()

    # Execute fetch
    query = query.order_by(desc(Event.created_at)).offset(skip).limit(limit)
    
    # We also want camera name, so let's join Camera or do it manually.
    # Actually, relationship might not be loaded if we just select(Event).
    # Let's use joinedload to get camera.name
    from sqlalchemy.orm import joinedload
    query = query.options(joinedload(Event.camera))
    
    result = await db.execute(query)
    events = result.scalars().all()

    # Format response
    formatted_events = []
    for ev in events:
        snapshot_url = None
        if ev.snapshot_minio_key:
            # Generate presigned URL
            try:
                snapshot_url = minio_service.get_presigned_url(
                    bucket=settings.MINIO_BUCKET_RECORDINGS,
                    object_name=ev.snapshot_minio_key,
                    expires_seconds=3600
                )
            except Exception:
                pass

        formatted_events.append({
            "id": str(ev.id),
            "camera_id": str(ev.camera_id),
            "camera_name": ev.camera.name if ev.camera else "Unknown",
            "event_type": ev.event_type.value,
            "created_at": ev.created_at.isoformat() if ev.created_at else None,
            "snapshot_url": snapshot_url
        })

    return {
        "events": formatted_events,
        "total": total
    }

@router.delete("/{event_id}")
async def delete_event(
    event_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Event).where(Event.id == event_id)
    result = await db.execute(query)
    ev = result.scalar_one_or_none()
    
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
        
    if current_user.role != UserRole.admin:
        access = await db.execute(
            select(UserCameraAccess).where(
                UserCameraAccess.user_id == current_user.id,
                UserCameraAccess.camera_id == ev.camera_id,
            )
        )
        if not access.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="No access to delete this event")
            
    if ev.snapshot_minio_key:
        try:
            minio_service.delete_object(settings.MINIO_BUCKET_RECORDINGS, ev.snapshot_minio_key)
        except Exception as e:
            pass # ignore minio errors if file doesn't exist
            
    await db.delete(ev)
    await db.commit()
    return {"message": "Event deleted successfully"}
