"""
Pydantic schemas for recording & playback endpoints.
"""

from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List


# ── Response Schemas ──────────────────────────────────────────

class RecordingResponse(BaseModel):
    """Single recording metadata."""
    id: UUID
    camera_id: UUID
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    file_size_bytes: Optional[int] = None
    status: str  # "recording" | "completed" | "expired"
    minio_playlist_key: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RecordingListResponse(BaseModel):
    """Paginated list of recordings."""
    recordings: List[RecordingResponse]
    total: int


class PlaybackUrlResponse(BaseModel):
    """Playback URL for a recording (presigned or proxied)."""
    recording_id: UUID
    camera_id: UUID
    playlist_url: str
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str


class RecordingStatusResponse(BaseModel):
    """Overall recording manager status."""
    active_cameras: int
    cameras: List[dict]  # [{camera_id, camera_name, status, recording_id}]
