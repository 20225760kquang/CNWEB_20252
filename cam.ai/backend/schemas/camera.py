"""
Pydantic schemas for camera management endpoints.
"""

from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List


# ── Request Schemas ───────────────────────────────────────────

class CameraCreate(BaseModel):
    """Admin adds a new camera."""
    name: str = Field(..., min_length=1, max_length=100)
    rtsp_url_hd: str = Field(..., max_length=500)
    rtsp_url_sd: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, max_length=200)
    recording_enabled: bool = True
    ai_enabled: bool = False


class CameraUpdate(BaseModel):
    """Admin updates camera configuration."""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    rtsp_url_hd: Optional[str] = Field(None, max_length=500)
    rtsp_url_sd: Optional[str] = Field(None, max_length=500)
    location: Optional[str] = Field(None, max_length=200)
    status: Optional[str] = Field(None, pattern="^(online|offline|error)$")
    recording_enabled: Optional[bool] = None
    ai_enabled: Optional[bool] = None


# ── Response Schemas ──────────────────────────────────────────

class CameraResponse(BaseModel):
    id: UUID
    name: str
    rtsp_url_hd: str
    rtsp_url_sd: Optional[str] = None
    location: Optional[str] = None
    status: str
    recording_enabled: bool
    ai_enabled: bool
    stream_hd: Optional[str] = None  # WebRTC URL (populated at runtime)
    stream_sd: Optional[str] = None  # WebRTC URL (populated at runtime)
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CameraListResponse(BaseModel):
    cameras: List[CameraResponse]
    total: int


class StreamUrlResponse(BaseModel):
    """WebRTC stream URL for a camera."""
    camera_id: UUID
    camera_name: str
    webrtc_url: str
    quality: str  # "hd" or "sd"
