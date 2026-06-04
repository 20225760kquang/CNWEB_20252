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

import asyncio
import logging
import cv2

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

from services.mediamtx_service import mediamtx_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/cameras", tags=["Camera Management"])


# ── Helper: RTSP Validation ──────────────────────────────────────────

async def validate_rtsp_stream(rtsp_url: str, timeout_seconds: int = 5) -> bool:
    """
    Kiểm tra luồng RTSP có hoạt động hay không bằng cách thử kết nối và đọc 1 frame.
    Chạy trong thread pool để không block event loop.
    """
    if not rtsp_url:
        return False

    try:
        loop = asyncio.get_event_loop()

        def _check():
            # Kiểm tra nhanh bằng opencv
            cap = cv2.VideoCapture(rtsp_url)
            if not cap.isOpened():
                return False
            ret, frame = cap.read()
            cap.release()
            return ret

        future = loop.run_in_executor(None, _check)
        result = await asyncio.wait_for(future, timeout=timeout_seconds)
        return result
    except asyncio.TimeoutError:
        logger.warning(f"Timeout khi kết nối đến RTSP URL: {rtsp_url}")
        return False
    except Exception as e:
        logger.error(f"Lỗi khi kiểm tra RTSP URL {rtsp_url}: {e}")
        return False


# ── Helper: MediaMTX path names ──────────────────────────────
def _get_mtx_paths(camera: Camera) -> dict:
    """
    Đặt tên path trên MediaMTX dựa theo Camera UUID.
    Ví dụ: cam_<uuid>_hd, cam_<uuid>_sd
    Cách này tránh lỗi khi tách path từ RTSP URL có cấu trúc phức tạp
    (như Dahua: /cam/realmonitor?channel=1&subtype=0)
    Cần thiết để làm 1 định danh duy nhất cho camera ! 
    Đảm bảo yếu tố bảo mật tránh lộ URL gốc của camera bao gồm account của admin!
    """
    cam_id = str(camera.id).replace("-", "")[:12]  # 12 ký tự đầu UUID
    return {
        "hd": f"cam_{cam_id}_hd" if camera.rtsp_url_hd else None,
        "sd": f"cam_{cam_id}_sd" if camera.rtsp_url_sd else None,
    }


# ── Helper: Build WebRTC URLs ─────────────────────────────────────────────────
def _build_stream_urls(camera: Camera) -> dict:
    """
    Generate WebRTC WHEP URLs từ path đã được FFmpeg transcode sang H.264.
    - Path gốc (H.265): cam_<uuid>_hd
    - Path đã transcode (H.264): cam_<uuid>_hd_264  ← trình duyệt WebRTC đọc được
    """
    base = settings.MEDIAMTX_WEBRTC_URL
    paths = _get_mtx_paths(camera)

    return {
        "stream_hd": f"{base}/{paths['hd']}_264/whep" if paths["hd"] else None,
        "stream_sd": f"{base}/{paths['sd']}_264/whep" if paths["sd"] else None,
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
    search: str = Query(None, description="Search by name or location"),
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
        query = select(Camera)
        count_query = select(func.count(Camera.id))
        
        if search:
            search_term = f"%{search}%"
            filter_cond = (Camera.name.ilike(search_term)) | (Camera.location.ilike(search_term))
            query = query.where(filter_cond)
            count_query = count_query.where(filter_cond)

        count_result = await db.execute(count_query)
        total = count_result.scalar()

        result = await db.execute(
            query.order_by(Camera.created_at.desc()).offset(skip).limit(limit)
        )
        cameras = result.scalars().all()
    else:
        # Viewer sees only assigned cameras
        query = select(Camera).join(UserCameraAccess, UserCameraAccess.camera_id == Camera.id).where(UserCameraAccess.user_id == current_user.id)
        count_query = select(func.count(Camera.id)).select_from(Camera).join(UserCameraAccess, UserCameraAccess.camera_id == Camera.id).where(UserCameraAccess.user_id == current_user.id)
        
        if search:
            search_term = f"%{search}%"
            filter_cond = (Camera.name.ilike(search_term)) | (Camera.location.ilike(search_term))
            query = query.where(filter_cond)
            count_query = count_query.where(filter_cond)
            
        count_result = await db.execute(count_query)
        total = count_result.scalar()

        result = await db.execute(
            query.order_by(Camera.created_at.desc()).offset(skip).limit(limit)
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
    # 1. Validate RTSP Stream
    is_valid_hd = await validate_rtsp_stream(body.rtsp_url_hd)
    if not is_valid_hd:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="HD RTSP URL is invalid or unreachable"
        )
    
    if body.rtsp_url_sd:
        is_valid_sd = await validate_rtsp_stream(body.rtsp_url_sd)
        if not is_valid_sd:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="SD RTSP URL is invalid or unreachable"
            )

    # 2. Add to Database
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

    # 3. Add path to MediaMTX (dùng UUID-based path name)
    paths = _get_mtx_paths(new_camera)
    await mediamtx_service.add_path(paths["hd"], new_camera.rtsp_url_hd)
    if new_camera.rtsp_url_sd:
        await mediamtx_service.add_path(paths["sd"], new_camera.rtsp_url_sd)

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

    # Store old paths to clean up if changed
    old_paths = _get_mtx_paths(camera)
    
    # Lưu trạng thái cũ để so sánh
    old_recording_enabled = camera.recording_enabled
    old_ai_enabled = camera.ai_enabled

    update_data = body.model_dump(exclude_unset=True)
    
    # 1. Validate new RTSP URLs if provided
    if "rtsp_url_hd" in update_data:
        is_valid_hd = await validate_rtsp_stream(update_data["rtsp_url_hd"])
        if not is_valid_hd:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New HD RTSP URL is invalid or unreachable"
            )
            
    if "rtsp_url_sd" in update_data and update_data["rtsp_url_sd"]:
        is_valid_sd = await validate_rtsp_stream(update_data["rtsp_url_sd"])
        if not is_valid_sd:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New SD RTSP URL is invalid or unreachable"
            )

    if "status" in update_data:
        update_data["status"] = CameraStatus(update_data["status"])

    for field, value in update_data.items():
        setattr(camera, field, value)

    await db.flush()
    await db.refresh(camera)

    # 3. Update MediaMTX — path name không đổi (dùng UUID) nên chỉ cần update source
    # Lưu ý: Có thể văng log path already exists, nhưng không ảnh hưởng
    new_paths = _get_mtx_paths(camera)
    if "rtsp_url_hd" in update_data and new_paths["hd"]:
        await mediamtx_service.add_path(new_paths["hd"], camera.rtsp_url_hd)
    if "rtsp_url_sd" in update_data and new_paths["sd"]:
        await mediamtx_service.add_path(new_paths["sd"], camera.rtsp_url_sd)

    # 4. Start/Stop Recording Manager if recording_enabled changed
    from tasks.recorder import recording_manager
    from tasks.ai_worker import ai_worker_manager

    if old_recording_enabled and not camera.recording_enabled:
        await recording_manager.stop_camera(camera.id)
    elif not old_recording_enabled and camera.recording_enabled:
        await recording_manager.start_camera(camera)

    # 5. Start/Stop AI Worker if ai_enabled changed
    if old_ai_enabled and not camera.ai_enabled:
        await ai_worker_manager.stop_camera(camera.id)
    elif not old_ai_enabled and camera.ai_enabled:
        await ai_worker_manager.start_camera(camera)

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

    # Stop recording if active (kill FFmpeg, final sync, finalize DB record)
    from tasks.recorder import recording_manager
    await recording_manager.stop_camera(camera_id)

    # Clean up MediaMTX paths
    paths = _get_mtx_paths(camera)
    if paths["hd"]:
        await mediamtx_service.remove_path(paths["hd"])
    if paths["sd"]:
        await mediamtx_service.remove_path(paths["sd"])

    # Clean up MinIO segments for this camera
    from services.minio_service import minio_service
    from config import settings as cfg
    cam_prefix = f"{str(camera_id)}/"
    minio_service.delete_objects_by_prefix(cfg.MINIO_BUCKET_RECORDINGS, cam_prefix)

    # Clean up local temp files
    import shutil, os
    local_cam_dir = os.path.join(cfg.RECORDING_LOCAL_DIR, str(camera_id))
    if os.path.isdir(local_cam_dir):
        shutil.rmtree(local_cam_dir, ignore_errors=True)

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
