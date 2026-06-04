"""
Recording & Playback router.
GET    /api/cameras/{id}/recordings          - List recordings for a camera
GET    /api/recordings/{id}/playlist.m3u8    - HLS playlist (rewritten URLs)
GET    /api/recordings/{id}/segments/{name}  - Proxy a single .ts segment
POST   /api/cameras/{id}/recording/start     - Start recording (Admin)
POST   /api/cameras/{id}/recording/stop      - Stop recording (Admin)
GET    /api/recordings/status                - Recording manager status
"""

import re
from uuid import UUID
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.user import User, UserRole
from models.camera import Camera
from models.recording import Recording, RecordingStatus
from models.user_camera_access import UserCameraAccess
from schemas.recording import (
    RecordingResponse,
    RecordingListResponse,
    PlaybackUrlResponse,
    RecordingStatusResponse,
)
from middleware.auth import get_current_active_user, require_admin
from services.minio_service import minio_service
from tasks.recorder import recording_manager

router = APIRouter(tags=["Recording & Playback"])


# ── Helper: Camera access check (reuse logic from cameras router) ─

async def _get_camera_with_access(
    camera_id: UUID, user: User, db: AsyncSession,
) -> Camera:
    """Fetch camera with access check (admin=all, viewer=assigned only)."""
    """Phân quyền RBAC, admin được quyền truy cập toàn bộ camera"""
    """Đối với viewer thì chỉ có thể xem được camera được admin cấp quyền!!!"""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    camera = result.scalar_one_or_none()

    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found",
        )

    if user.role != UserRole.admin:
        access = await db.execute(
            select(UserCameraAccess).where(
                UserCameraAccess.user_id == user.id,
                UserCameraAccess.camera_id == camera_id,
            )
        )
        if not access.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this camera",
            )

    return camera


def _recording_to_response(rec: Recording) -> RecordingResponse:
    """Convert Recording model to response schema."""
    return RecordingResponse(
        id=rec.id,
        camera_id=rec.camera_id,
        start_time=rec.start_time,
        end_time=rec.end_time,
        duration_seconds=rec.duration_seconds,
        file_size_bytes=rec.file_size_bytes,
        status=rec.status.value,
        minio_playlist_key=rec.minio_playlist_key,
        created_at=rec.created_at,
    )


# ── GET /api/cameras/{id}/recordings ─────────────────────────

@router.get(
    "/api/cameras/{camera_id}/recordings",
    response_model=RecordingListResponse,
)
async def list_recordings(
    camera_id: UUID,
    hours: int = Query(6, ge=1, le=24, description="Lấy recordings trong N giờ gần nhất"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List recordings for a camera within the last N hours.
    Default: 6 hours. Sorted by start_time descending.

    Uses overlap filter: includes recordings that started before the cutoff
    but have end_time after it (i.e., contain data within the time window),
    as well as recordings still in progress (end_time IS NULL).
    """
    await _get_camera_with_access(camera_id, current_user, db)

    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    # Filter: recording overlaps with [cutoff, now]
    # → end_time > cutoff (completed recordings that extend past cutoff)
    # → OR end_time IS NULL (still recording)
    time_filter = or_(
        Recording.end_time > cutoff,
        Recording.end_time == None,  # noqa: E711 (SQLAlchemy requires == None)
    )

    # Count total
    count_result = await db.execute(
        select(func.count(Recording.id)).where(
            Recording.camera_id == camera_id,
            time_filter,
            Recording.status != RecordingStatus.expired,
        )
    )
    total = count_result.scalar()

    # Fetch recordings
    result = await db.execute(
        select(Recording)
        .where(
            Recording.camera_id == camera_id,
            time_filter,
            Recording.status != RecordingStatus.expired,
        )
        .order_by(Recording.start_time.desc())
        .offset(skip)
        .limit(limit)
    )
    recordings = result.scalars().all()

    return RecordingListResponse(
        recordings=[_recording_to_response(r) for r in recordings],
        total=total,
    )


# ── GET /api/recordings/{id}/playlist.m3u8 ───────────────────

@router.get("/api/recordings/{recording_id}/playlist.m3u8")
async def get_playlist(
    recording_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get HLS playlist for playback.
    Reads index.m3u8 from MinIO, rewrites segment URLs to presigned MinIO URLs.
    """
    # Fetch recording
    result = await db.execute(
        select(Recording).where(Recording.id == recording_id)
    )
    recording = result.scalar_one_or_none()

    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording not found",
        )

    # Check access to the camera
    await _get_camera_with_access(recording.camera_id, current_user, db)

    # Read .m3u8 from MinIO
    m3u8_content = minio_service.get_object_content(
        recording.minio_bucket,
        recording.minio_playlist_key,
    )

    if not m3u8_content:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Playlist file not found on storage",
        )

    # Rewrite segment URLs to presigned MinIO URLs
    prefix = recording.minio_playlist_key.rsplit("/", 1)[0]
    rewritten_lines = []

    for line in m3u8_content.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            # This is a segment filename (e.g., "seg_00001.ts")
            minio_key = f"{prefix}/{stripped}"
            presigned_url = minio_service.get_presigned_url(
                recording.minio_bucket,
                minio_key,
                expires_seconds=7200,  # 2 hours
            )
            if presigned_url:
                rewritten_lines.append(presigned_url)
            else:
                # Fallback: proxy through backend
                rewritten_lines.append(
                    f"/api/recordings/{recording_id}/segments/{stripped}"
                )
        else:
            rewritten_lines.append(line)

    rewritten_m3u8 = "\n".join(rewritten_lines) + "\n"

    return Response(
        content=rewritten_m3u8,
        media_type="application/vnd.apple.mpegurl",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-cache",
        },
    )


# ── GET /api/recordings/{id}/segments/{filename} ─────────────

@router.get("/api/recordings/{recording_id}/segments/{filename}")
async def get_segment(
    recording_id: UUID,
    filename: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Proxy a single .ts segment from MinIO.
    Fallback route if presigned URLs hit CORS issues.
    """
    # Validate filename
    if not re.match(r"^seg_\d{5}\.ts$", filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid segment filename",
        )

    # Fetch recording
    result = await db.execute(
        select(Recording).where(Recording.id == recording_id)
    )
    recording = result.scalar_one_or_none()

    if not recording:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recording not found",
        )

    # Check access
    await _get_camera_with_access(recording.camera_id, current_user, db)

    # Fetch segment from MinIO
    prefix = recording.minio_playlist_key.rsplit("/", 1)[0]
    minio_key = f"{prefix}/{filename}"

    data = minio_service.get_object_bytes(recording.minio_bucket, minio_key)

    if not data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Segment not found",
        )

    return Response(
        content=data,
        media_type="video/mp2t",
        headers={
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",  # Segments are immutable
        },
    )


# ── POST /api/cameras/{id}/recording/start ───────────────────

@router.post(
    "/api/cameras/{camera_id}/recording/start",
    status_code=status.HTTP_200_OK,
)
async def start_recording(
    camera_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Start recording for a specific camera (Admin only)."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    camera = result.scalar_one_or_none()

    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found",
        )

    # Update recording_enabled flag
    camera.recording_enabled = True
    await db.flush()
    await db.refresh(camera)

    # Start the recorder
    started = await recording_manager.start_camera(camera)

    if not started:
        return {"message": f"Camera '{camera.name}' is already recording"}

    return {"message": f"Recording started for camera '{camera.name}'"}


# ── POST /api/cameras/{id}/recording/stop ────────────────────

@router.post(
    "/api/cameras/{camera_id}/recording/stop",
    status_code=status.HTTP_200_OK,
)
async def stop_recording(
    camera_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Stop recording for a specific camera (Admin only)."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    camera = result.scalar_one_or_none()

    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found",
        )

    # Update recording_enabled flag
    camera.recording_enabled = False
    await db.flush()

    # Stop the recorder
    stopped = await recording_manager.stop_camera(camera_id)

    if not stopped:
        return {"message": f"Camera '{camera.name}' was not recording"}

    return {"message": f"Recording stopped for camera '{camera.name}'"}


# ── GET /api/recordings/status ───────────────────────────────

@router.get("/api/recordings/status", response_model=RecordingStatusResponse)
async def get_recording_status(
    admin: User = Depends(require_admin),
):
    """Get overall recording manager status (Admin only)."""
    status_data = recording_manager.get_status()
    return RecordingStatusResponse(**status_data)
