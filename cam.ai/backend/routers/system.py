from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from uuid import UUID
from datetime import datetime, timedelta, timezone

from database import get_db
from models.user import User, UserRole
from models.audit_log import AuditLog
from models.event import Event
from middleware.auth import require_admin
from services.notification_service import notification_manager

router = APIRouter(prefix="/api/system", tags=["System Dashboard"])

@router.get("/active-sessions")
async def get_active_sessions(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """
    Get users who are currently connected via WebSocket.
    """
    active_user_ids = list(notification_manager.active_connections.keys())
    
    if not active_user_ids:
        return {"sessions": [], "total": 0}
        
    query = select(User).where(User.id.in_(active_user_ids))
    result = await db.execute(query)
    users = result.scalars().all()
    
    sessions = []
    for u in users:
        sessions.append({
            "id": str(u.id),
            "user": u.username,
            "role": u.role.value,
            "loginTime": u.last_login_at.isoformat() if u.last_login_at else None,
            "initials": u.username[:2].upper() if u.username else "?",
            "color": "bg-blue-100 text-blue-600" if u.role == UserRole.viewer else "bg-purple-100 text-purple-600",
            "currentCamera": "N/A" # We don't track which camera they are viewing currently
        })
        
    return {"sessions": sessions, "total": len(sessions)}

@router.get("/audit-logs")
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    start_time: datetime = Query(None, description="Start time"),
    end_time: datetime = Query(None, description="End time"),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(AuditLog)
    count_query = select(func.count(AuditLog.id))
    
    if start_time:
        query = query.where(AuditLog.created_at >= start_time)
        count_query = count_query.where(AuditLog.created_at >= start_time)
    if end_time:
        query = query.where(AuditLog.created_at <= end_time)
        count_query = count_query.where(AuditLog.created_at <= end_time)
        
    total = (await db.execute(count_query)).scalar()
    
    query = query.order_by(desc(AuditLog.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    formatted_logs = []
    for log in logs:
        # Generate some color based on action type or user for UI
        color = "text-blue-600"
        if log.user_name == "admin":
            color = "text-primary"
            
        formatted_logs.append({
            "id": str(log.id),
            "timestamp": log.created_at.isoformat() if log.created_at else None,
            "user": log.user_name or "System",
            "action": log.action,
            "color": color
        })
        
    return {"logs": formatted_logs, "total": total}

@router.get("/device-events")
async def get_device_events(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    start_time: datetime = Query(None, description="Start time"),
    end_time: datetime = Query(None, description="End time"),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    query = select(Event).options(joinedload(Event.camera))
    count_query = select(func.count(Event.id))
    
    if start_time:
        st = start_time.astimezone().replace(tzinfo=None)
        query = query.where(Event.created_at >= st)
        count_query = count_query.where(Event.created_at >= st)
    if end_time:
        et = end_time.astimezone().replace(tzinfo=None)
        query = query.where(Event.created_at <= et)
        count_query = count_query.where(Event.created_at <= et)
        
    total = (await db.execute(count_query)).scalar()
    
    query = query.order_by(desc(Event.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    events = result.scalars().all()
    
    formatted_events = []
    for ev in events:
        dot_color = "bg-purple-500" if ev.event_type.value == "person_detected" else "bg-error"
        
        event_text = "Sự kiện"
        if ev.event_type.value == "person_detected":
            event_text = "Phát hiện có người"
        elif ev.event_type.value == "camera_offline":
            event_text = "Mất kết nối"
            
        formatted_events.append({
            "id": str(ev.id),
            "timestamp": ev.created_at.isoformat() if ev.created_at else None,
            "camera_name": ev.camera.name if ev.camera else "Unknown",
            "camera_location": ev.camera.location if ev.camera else "",
            "event_text": event_text,
            "dot": dot_color
        })
        
    return {"events": formatted_events, "total": total}
