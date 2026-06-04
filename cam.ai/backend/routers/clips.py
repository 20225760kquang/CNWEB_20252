"""
Clip export router.
GET  /api/clips           - List exported clips
POST /api/clips           - Create a new clip export (triggers FFmpeg in background)
"""

import logging
import os
import uuid
import asyncio
import subprocess
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, Query, HTTPException, status, BackgroundTasks, Request
from fastapi.responses import StreamingResponse
import urllib.parse
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload
from uuid import UUID
from datetime import datetime

from database import get_db, async_session
from models.user import User, UserRole
from models.recording import Recording
from models.clip_export import ClipExport, ExportStatus
from models.user_camera_access import UserCameraAccess
from middleware.auth import get_current_active_user, decode_token
from services.minio_service import minio_service
from schemas.clip import ClipListResponse, ClipExportCreate
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/clips", tags=["Clips"])


async def ffmpeg_export_task(clip_id: UUID, recording_id: UUID, clip_start: datetime, clip_end: datetime):
    """
    Real FFmpeg clip export:
    1. Parse the index.m3u8 playlist to find segment durations.
    2. Download only the .ts segments from MinIO that overlap with [clip_start, clip_end].
    3. Build a local m3u8 playlist with only those segments.
    4. Use FFmpeg to cut the clip starting from the correct offset relative to the first downloaded segment.
    5. Upload the .mp4 to MinIO.
    6. Update the ClipExport record status.
    """
    try:
        async with async_session() as db:
            rec_result = await db.execute(select(Recording).where(Recording.id == recording_id))
            recording = rec_result.scalar_one_or_none()
            if not recording:
                logger.error(f"[CLIP_EXPORT] Recording {recording_id} not found")
                return

            # Calculate offset within the recording
            rec_start = recording.start_time
            # Make both timezone-aware or both naive for comparison
            if rec_start.tzinfo is not None and clip_start.tzinfo is None:
                from datetime import timezone
                clip_start_aware = clip_start.replace(tzinfo=timezone.utc)
                clip_end_aware = clip_end.replace(tzinfo=timezone.utc)
            elif rec_start.tzinfo is None and clip_start.tzinfo is not None:
                clip_start_aware = clip_start.replace(tzinfo=None)
                clip_end_aware = clip_end.replace(tzinfo=None)
            else:
                clip_start_aware = clip_start
                clip_end_aware = clip_end

            ss_seconds = max(0.0, (clip_start_aware - rec_start).total_seconds())
            duration_seconds = (clip_end_aware - clip_start_aware).total_seconds()

            if duration_seconds <= 0:
                logger.error(f"[CLIP_EXPORT] Invalid duration: {duration_seconds}s")
                clip = await db.get(ClipExport, clip_id)
                if clip:
                    clip.status = ExportStatus.expired
                    await db.commit()
                return

            # Get the m3u8 content and segment list from MinIO
            m3u8_content = minio_service.get_object_content(
                recording.minio_bucket,
                recording.minio_playlist_key,
            )
            if not m3u8_content:
                logger.error(f"[CLIP_EXPORT] Playlist not found: {recording.minio_playlist_key}")
                clip = await db.get(ClipExport, clip_id)
                if clip:
                    clip.status = ExportStatus.expired
                    await db.commit()
                return

            prefix = recording.minio_playlist_key.rsplit("/", 1)[0]
            lines = m3u8_content.splitlines()

            # Parse segment offsets and filter segments overlapping with the clip range [ss_seconds, ss_seconds + duration_seconds]
            current_time = 0.0
            last_extinf_val = 0.0
            last_extinf_idx = None
            segments_to_download = []
            first_segment_start = None

            for idx, line in enumerate(lines):
                stripped = line.strip()
                if not stripped:
                    continue
                if stripped.startswith("#"):
                    if stripped.startswith("#EXTINF:"):
                        try:
                            dur_str = stripped[8:]
                            if "," in dur_str:
                                dur_str = dur_str.split(",")[0]
                            last_extinf_val = float(dur_str)
                            last_extinf_idx = idx
                        except Exception as e:
                            logger.warning(f"Failed to parse #EXTINF line '{stripped}': {e}")
                else:
                    # Segment filename
                    seg_name = stripped
                    seg_duration = last_extinf_val
                    seg_start = current_time
                    seg_end = current_time + seg_duration

                    clip_start_sec = ss_seconds
                    clip_end_sec = ss_seconds + duration_seconds

                    # Check if segment overlaps with requested clip range
                    if max(seg_start, clip_start_sec) < min(seg_end, clip_end_sec):
                        if first_segment_start is None:
                            first_segment_start = seg_start
                        segments_to_download.append({
                            "name": seg_name,
                            "extinf_line_idx": last_extinf_idx,
                            "duration": seg_duration,
                            "start": seg_start
                        })

                    current_time += seg_duration

            if not segments_to_download:
                logger.error(f"[CLIP_EXPORT] No segments found overlapping the requested range: {clip_start_aware} to {clip_end_aware}")
                clip = await db.get(ClipExport, clip_id)
                if clip:
                    clip.status = ExportStatus.expired
                    await db.commit()
                return

            # Create temp directory for working files
            with tempfile.TemporaryDirectory() as tmpdir:
                logger.info(f"[CLIP_EXPORT] Downloading {len(segments_to_download)} segments out of {len(lines)//2} total...")

                for seg in segments_to_download:
                    seg_name = seg["name"]
                    minio_key = f"{prefix}/{seg_name}"
                    seg_data = minio_service.get_object_bytes(recording.minio_bucket, minio_key)
                    if seg_data:
                        seg_path = os.path.join(tmpdir, seg_name)
                        with open(seg_path, "wb") as f:
                            f.write(seg_data)
                    else:
                        logger.error(f"[CLIP_EXPORT] Failed to download segment {minio_key}")
                        clip = await db.get(ClipExport, clip_id)
                        if clip:
                            clip.status = ExportStatus.expired
                            await db.commit()
                        return

                # Gather header lines
                header_lines = []
                for line in lines:
                    stripped = line.strip()
                    if stripped.startswith("#"):
                        if stripped.startswith("#EXTINF") or stripped.startswith("#EXT-X-BYTERANGE"):
                            break
                        header_lines.append(line)
                    else:
                        break

                # Write local m3u8 with only the downloaded segments
                local_m3u8_lines = list(header_lines)
                for seg in segments_to_download:
                    if seg["extinf_line_idx"] is not None:
                        local_m3u8_lines.append(lines[seg["extinf_line_idx"]])
                    else:
                        local_m3u8_lines.append(f"#EXTINF:{seg['duration']:.6f},")
                    local_m3u8_lines.append(seg["name"])

                local_m3u8_lines.append("#EXT-X-ENDLIST")

                local_m3u8 = os.path.join(tmpdir, "index.m3u8")
                with open(local_m3u8, "w") as f:
                    f.write("\n".join(local_m3u8_lines) + "\n")

                # Output file
                output_mp4 = os.path.join(tmpdir, f"{clip_id}.mp4")

                # Seek offset in the new local playlist
                new_ss = max(0.0, ss_seconds - first_segment_start)

                # Build FFmpeg command
                # Use new_ss as seek offset in local_m3u8
                cmd = [
                    "ffmpeg", "-y",
                    "-ss", f"{new_ss:.6f}",
                    "-i", local_m3u8,
                    "-t", f"{duration_seconds:.6f}",
                    "-c", "copy",
                    "-movflags", "+faststart",
                    "-f", "mp4",
                    output_mp4,
                ]

                logger.info(f"[CLIP_EXPORT] Running: {' '.join(cmd)}")

                # Run FFmpeg in a subprocess
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await process.communicate()

                if process.returncode != 0:
                    logger.error(f"[CLIP_EXPORT] FFmpeg failed: {stderr.decode()}")
                    clip = await db.get(ClipExport, clip_id)
                    if clip:
                        clip.status = ExportStatus.expired
                        await db.commit()
                    return

                # Check output exists
                if not os.path.exists(output_mp4):
                    logger.error(f"[CLIP_EXPORT] Output file not created")
                    clip = await db.get(ClipExport, clip_id)
                    if clip:
                        clip.status = ExportStatus.expired
                        await db.commit()
                    return

                file_size = os.path.getsize(output_mp4)
                logger.info(f"[CLIP_EXPORT] Output size: {file_size} bytes")

                # Upload to MinIO
                minio_key = f"clips/{clip_id}.mp4"
                uploaded = minio_service.upload_file(
                    bucket=settings.MINIO_BUCKET_RECORDINGS,
                    object_name=minio_key,
                    file_path=output_mp4,
                    content_type="video/mp4",
                )

                if not uploaded:
                    logger.error(f"[CLIP_EXPORT] Upload to MinIO failed")
                    clip = await db.get(ClipExport, clip_id)
                    if clip:
                        clip.status = ExportStatus.expired
                        await db.commit()
                    return

                # Update DB record
                clip = await db.get(ClipExport, clip_id)
                if clip:
                    clip.status = ExportStatus.ready
                    clip.minio_key = minio_key
                    await db.commit()

                logger.info(f"[CLIP_EXPORT] ✅ Clip {clip_id} exported successfully ({file_size} bytes)")

    except Exception as e:
        logger.error(f"[CLIP_EXPORT] Error exporting clip {clip_id}: {e}", exc_info=True)
        try:
            async with async_session() as db:
                clip = await db.get(ClipExport, clip_id)
                if clip:
                    clip.status = ExportStatus.expired
                    await db.commit()
        except:
            pass


@router.get("", response_model=ClipListResponse)
async def get_clips(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(ClipExport).options(
        joinedload(ClipExport.recording).joinedload(Recording.camera)
    )
    
    if current_user.role != UserRole.admin:
        query = query.where(ClipExport.user_id == current_user.id)
        
    query = query.order_by(desc(ClipExport.created_at))
    
    result = await db.execute(query.offset(skip).limit(limit))
    clips = result.scalars().all()
    
    # Count total
    count_query = select(func.count(ClipExport.id))
    if current_user.role != UserRole.admin:
        count_query = count_query.where(ClipExport.user_id == current_user.id)
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    formatted_clips = []
    for c in clips:
        download_url = None
        if c.status == ExportStatus.ready and c.minio_key:
            try:
                download_url = minio_service.get_presigned_url(
                    bucket=settings.MINIO_BUCKET_RECORDINGS,
                    object_name=c.minio_key,
                    expires_seconds=3600
                )
            except:
                pass
        
        formatted_clips.append({
            "id": c.id,
            "user_id": c.user_id,
            "recording_id": c.recording_id,
            "camera_name": c.recording.camera.name if c.recording and c.recording.camera else "Unknown",
            "clip_start": c.clip_start,
            "clip_end": c.clip_end,
            "status": c.status,
            "created_at": c.created_at,
            "download_url": download_url
        })
        
    return {"clips": formatted_clips, "total": total}

@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def create_clip(
    data: ClipExportCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    # Verify recording exists and user has access
    rec_result = await db.execute(
        select(Recording).where(Recording.id == data.recording_id)
    )
    recording = rec_result.scalar_one_or_none()
    if not recording:
        raise HTTPException(status_code=404, detail="Recording not found")
        
    if current_user.role != UserRole.admin:
        access = await db.execute(
            select(UserCameraAccess).where(
                UserCameraAccess.user_id == current_user.id,
                UserCameraAccess.camera_id == recording.camera_id,
                UserCameraAccess.can_export == True
            )
        )
        if not access.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="No export permission for this camera")

    # Validate duration (max 10 minutes)
    duration = (data.clip_end - data.clip_start).total_seconds()
    if duration <= 0:
        raise HTTPException(status_code=400, detail="Thời gian kết thúc phải sau thời gian bắt đầu")
    if duration > 600:
        raise HTTPException(status_code=400, detail="Thời lượng clip tối đa là 10 phút")

    new_clip = ClipExport(
        user_id=current_user.id,
        recording_id=data.recording_id,
        clip_start=data.clip_start,
        clip_end=data.clip_end,
        status=ExportStatus.processing
    )
    db.add(new_clip)
    await db.commit()
    await db.refresh(new_clip)
    
    # Start real FFmpeg export task
    background_tasks.add_task(
        ffmpeg_export_task, new_clip.id, data.recording_id, data.clip_start, data.clip_end
    )
    
    return {"message": "Clip export started", "clip_id": new_clip.id}


@router.delete("/{clip_id}", status_code=status.HTTP_200_OK)
async def delete_clip(
    clip_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a clip export. Owner or admin only."""
    clip = await db.get(ClipExport, clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    # Only owner or admin can delete
    if current_user.role != UserRole.admin and clip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền xóa clip này")

    # Delete file from MinIO if exists
    if clip.minio_key:
        try:
            minio_service.delete_object(
                bucket=settings.MINIO_BUCKET_RECORDINGS,
                object_name=clip.minio_key,
            )
        except Exception as e:
            logger.warning(f"[CLIP_DELETE] Failed to delete MinIO object {clip.minio_key}: {e}")

    await db.delete(clip)
    await db.commit()

    return {"message": "Đã xóa clip thành công"}


async def get_current_user_flexible(
    request: Request,
    token_query: str | None = Query(None, alias="token"),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Get current user either from Authorization Header (Bearer token)
    or from 'token' Query Parameter (useful for direct file download links).
    """
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
    elif token_query:
        token = token_query

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing",
        )

    # Decode and validate
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type",
        )

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing subject",
        )

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    return user


@router.get("/{clip_id}/download")
async def download_clip_file(
    clip_id: UUID,
    current_user: User = Depends(get_current_user_flexible),
    db: AsyncSession = Depends(get_db),
):
    """
    Proxy clip download from MinIO.
    This routes the download through the backend, avoiding direct MinIO access
    issues (such as localhost vs public IP) for clients, and forces browser download.
    """
    # Use joinedload to fetch recording and camera for filename creation
    query = select(ClipExport).options(
        joinedload(ClipExport.recording).joinedload(Recording.camera)
    ).where(ClipExport.id == clip_id)
    
    result = await db.execute(query)
    clip = result.scalar_one_or_none()
    if not clip:
        raise HTTPException(status_code=404, detail="Clip not found")

    if current_user.role != UserRole.admin and clip.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Bạn không có quyền tải clip này")

    if clip.status != ExportStatus.ready or not clip.minio_key:
        raise HTTPException(status_code=400, detail="Clip chưa sẵn sàng hoặc đã hết hạn")

    try:
        # Get raw data stream from MinIO
        response = minio_service.client.get_object(
            settings.MINIO_BUCKET_RECORDINGS,
            clip.minio_key
        )
    except Exception as e:
        logger.error(f"[CLIP_DOWNLOAD] Failed to get object from MinIO: {e}")
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp video trên hệ thống lưu trữ")

    camera_name = clip.recording.camera.name if clip.recording and clip.recording.camera else "camera"
    filename = f"clip_{camera_name}_{clip.id}.mp4"
    encoded_filename = urllib.parse.quote(filename)

    # Use StreamingResponse to stream it to client directly
    def iterfile():
        try:
            for chunk in response.stream(32 * 1024):
                yield chunk
        finally:
            response.close()
            response.release_conn()

    return StreamingResponse(
        iterfile(),
        media_type="video/mp4",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}",
            "Access-Control-Expose-Headers": "Content-Disposition"
        }
    )
