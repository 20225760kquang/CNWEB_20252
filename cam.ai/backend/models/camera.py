"""
SQLAlchemy Camera model.
Status: online | offline | error
"""

import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Boolean, Enum, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class CameraStatus(str, enum.Enum):
    online = "online"
    offline = "offline"
    error = "error"


class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )
    rtsp_url_hd: Mapped[str] = mapped_column(
        String(500), nullable=False
    )
    rtsp_url_sd: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    location: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    status: Mapped[CameraStatus] = mapped_column(
        Enum(CameraStatus, name="camera_status", create_constraint=True),
        default=CameraStatus.offline,
    )
    recording_enabled: Mapped[bool] = mapped_column(
        Boolean, default=True
    )
    ai_enabled: Mapped[bool] = mapped_column(
        Boolean, default=False
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ── Relationships ─────────────────────────────────────────
    user_access = relationship(
        "UserCameraAccess", back_populates="camera", cascade="all, delete-orphan"
    )
    recordings = relationship(
        "Recording", back_populates="camera", cascade="all, delete-orphan"
    )
    events = relationship(
        "Event", back_populates="camera", cascade="all, delete-orphan"
    )
    snapshots = relationship(
        "Snapshot", back_populates="camera", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Camera {self.name} ({self.status.value})>"
