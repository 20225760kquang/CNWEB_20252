"""
Schemas package.
"""

from schemas.auth import (
    LoginRequest, RefreshRequest, UserBrief,
    TokenResponse, TokenRefreshResponse,
)
from schemas.user import (
    UserCreate, UserUpdate, UserCameraAssign, CameraPermission,
    UserResponse, UserListResponse, CameraAccessResponse, UserDetailResponse,
)
from schemas.camera import (
    CameraCreate, CameraUpdate,
    CameraResponse, CameraListResponse, StreamUrlResponse,
)
from schemas.recording import (
    RecordingResponse, RecordingListResponse,
    PlaybackUrlResponse, RecordingStatusResponse,
)

