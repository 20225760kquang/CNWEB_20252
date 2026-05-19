"""
Camera management router.
GET    /api/cameras              - List cameras (role-aware)
GET    /api/cameras/{id}         - Camera detail
POST   /api/cameras              - Add camera (Admin)
PUT    /api/cameras/{id}         - Update camera (Admin)
DELETE /api/cameras/{id}         - Delete camera (Admin)
GET    /api/cameras/{id}/stream/hd - WebRTC HD stream URL
GET    /api/cameras/{id}/stream/sd - WebRTC SD stream URL
"""

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.user import User, UserRole
from models.camera import Camera, CameraStatus
from models.user_camera_access import UserCameraAccess
from schemas.camera import (
    CameraCreate, CameraUpdate,
    CameraResponse, CameraListResponse, StreamUrlResponse,
)
from middleware.auth import get_current_active_user, require_admin

router = APIRouter(prefix="/api/cameras", tags=["Camera Management"])


# ── Helper: Build WebRTC URLs ─────────────────────────────────
def _build_stream_urls(camera: Camera) -> dict:
    """Generate WebRTC WHEP URLs from RTSP paths via MediaMTX."""
    base = settings.MEDIAMTX_WEBRTC_URL

    # Extract path from RTSP URL: rtsp://host:port/path -> path
    hd_path = camera.rtsp_url_hd.split("/")[-1] if camera.rtsp_url_hd else None
    sd_path = camera.rtsp_url_sd.split("/")[-1] if camera.rtsp_url_sd else None

    return {
        "stream_hd": f"{base}/{hd_path}/whep" if hd_path else None,
        "stream_sd": f"{base}/{sd_path}/whep" if sd_path else None,
    }


def _camera_to_response(camera: Camera) -> CameraResponse:
    """Convert Camera model to response with stream URLs."""
    urls = _build_stream_urls(camera)
    return CameraResponse(
        id=camera.id,
        name=camera.name,
        rtsp_url_hd=camera.rtsp_url_hd,
        rtsp_url_sd=camera.rtsp_url_sd,
        location=camera.location,
        status=camera.status.value,
        recording_enabled=camera.recording_enabled,
        ai_enabled=camera.ai_enabled,
        stream_hd=urls["stream_hd"],
        stream_sd=urls["stream_sd"],
        created_at=camera.created_at,
        updated_at=camera.updated_at,
    )


# ── GET /api/cameras ──────────────────────────────────────────
@router.get("", response_model=CameraListResponse)
async def list_cameras(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List cameras the user has access to.
    - Admin: sees all cameras.
    - Viewer: sees only assigned cameras.
    """
    if current_user.role == UserRole.admin:
        # Admin sees all
        count_result = await db.execute(select(func.count(Camera.id)))
        total = count_result.scalar()

        result = await db.execute(
            select(Camera)
            .order_by(Camera.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        cameras = result.scalars().all()
    else:
        # Viewer sees only assigned cameras
        count_result = await db.execute(
            select(func.count(Camera.id))
            .select_from(Camera)
            .join(UserCameraAccess, UserCameraAccess.camera_id == Camera.id)
            .where(UserCameraAccess.user_id == current_user.id)
        )
        total = count_result.scalar()

        result = await db.execute(
            select(Camera)
            .join(UserCameraAccess, UserCameraAccess.camera_id == Camera.id)
            .where(UserCameraAccess.user_id == current_user.id)
            .order_by(Camera.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        cameras = result.scalars().all()

    return CameraListResponse(
        cameras=[_camera_to_response(c) for c in cameras],
        total=total,
    )


# ── GET /api/cameras/{id} ────────────────────────────────────
@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(
    camera_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get camera detail. Viewer must have access."""
    camera = await _get_camera_with_access_check(camera_id, current_user, db)
    return _camera_to_response(camera)


# ── POST /api/cameras ────────────────────────────────────────
@router.post("", response_model=CameraResponse, status_code=status.HTTP_201_CREATED)
async def create_camera(
    body: CameraCreate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add a new camera (Admin only)."""
    new_camera = Camera(
        name=body.name,
        rtsp_url_hd=body.rtsp_url_hd,
        rtsp_url_sd=body.rtsp_url_sd,
        location=body.location,
        recording_enabled=body.recording_enabled,
        ai_enabled=body.ai_enabled,
    )
    db.add(new_camera)
    await db.flush()
    await db.refresh(new_camera)

    return _camera_to_response(new_camera)


# ── PUT /api/cameras/{id} ────────────────────────────────────
@router.put("/{camera_id}", response_model=CameraResponse)
async def update_camera(
    camera_id: UUID,
    body: CameraUpdate,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update camera configuration (Admin only)."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    camera = result.scalar_one_or_none()

    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found",
        )

    update_data = body.model_dump(exclude_unset=True)
    if "status" in update_data:
        update_data["status"] = CameraStatus(update_data["status"])

    for field, value in update_data.items():
        setattr(camera, field, value)

    await db.flush()
    await db.refresh(camera)

    return _camera_to_response(camera)


# ── DELETE /api/cameras/{id} ──────────────────────────────────
@router.delete("/{camera_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_camera(
    camera_id: UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a camera and all related data (Admin only)."""
    result = await db.execute(select(Camera).where(Camera.id == camera_id))
    camera = result.scalar_one_or_none()

    if not camera:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Camera not found",
        )

    await db.delete(camera)
    await db.flush()


# ── GET /api/cameras/{id}/stream/hd ──────────────────────────
@router.get("/{camera_id}/stream/hd", response_model=StreamUrlResponse)
async def get_stream_hd(
    camera_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get WebRTC HD stream URL for a camera."""
    camera = await _get_camera_with_access_check(camera_id, current_user, db)
    urls = _build_stream_urls(camera)

    if not urls["stream_hd"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="HD stream not available for this camera",
        )

    return StreamUrlResponse(
        camera_id=camera.id,
        camera_name=camera.name,
        webrtc_url=urls["stream_hd"],
        quality="hd",
    )


# ── GET /api/cameras/{id}/stream/sd ──────────────────────────
@router.get("/{camera_id}/stream/sd", response_model=StreamUrlResponse)
async def get_stream_sd(
    camera_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get WebRTC SD stream URL for a camera."""
    camera = await _get_camera_with_access_check(camera_id, current_user, db)
    urls = _build_stream_urls(camera)

    if not urls["stream_sd"]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="SD stream not available for this camera",
        )

    return StreamUrlResponse(
        camera_id=camera.id,
        camera_name=camera.name,
        webrtc_url=urls["stream_sd"],
        quality="sd",
    )


# ── Helper: Access Check ─────────────────────────────────────
async def _get_camera_with_access_check(
    camera_id: UUID,
    user: User,
    db: AsyncSession,
) -> Camera:
    """
    Fetch camera by ID.
    Admin: direct access.
    Viewer: must have UserCameraAccess entry.
    """
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
