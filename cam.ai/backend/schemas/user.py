"""
Pydantic schemas for user management endpoints.
"""

from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List


# ── Request Schemas ───────────────────────────────────────────

class UserCreate(BaseModel):
    """Admin creates a new user."""
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(..., max_length=100)
    password: str = Field(..., min_length=6, max_length=128)
    role: str = Field(default="viewer", pattern="^(admin|viewer)$")


class UserUpdate(BaseModel):
    """Admin updates user info."""
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[str] = Field(None, max_length=100)
    password: Optional[str] = Field(None, min_length=6, max_length=128)
    role: Optional[str] = Field(None, pattern="^(admin|viewer)$")
    is_active: Optional[bool] = None


class CameraPermission(BaseModel):
    """Single camera permission entry."""
    camera_id: UUID
    can_playback: bool = True
    can_export: bool = True


class UserCameraAssign(BaseModel):
    """Assign camera permissions to a viewer."""
    cameras: List[CameraPermission]


# ── Response Schemas ──────────────────────────────────────────

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    role: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int


class CameraAccessResponse(BaseModel):
    camera_id: UUID
    camera_name: str
    can_playback: bool
    can_export: bool
    granted_at: datetime

    model_config = {"from_attributes": True}


class UserDetailResponse(UserResponse):
    """User detail with camera access info."""
    camera_access: List[CameraAccessResponse] = []
