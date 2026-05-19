"""
SQLAlchemy UserCameraAccess model.
Junction table for viewer ↔ camera permissions.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class UserCameraAccess(Base):
    __tablename__ = "user_camera_access"
    __table_args__ = (
        UniqueConstraint("user_id", "camera_id", name="uq_user_camera"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    camera_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cameras.id", ondelete="CASCADE"),
        nullable=False,
    )
    can_playback: Mapped[bool] = mapped_column(
        Boolean, default=True
    )
    can_export: Mapped[bool] = mapped_column(
        Boolean, default=True
    )
    granted_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )

    # ── Relationships ─────────────────────────────────────────
    user = relationship("User", back_populates="camera_access")
    camera = relationship("Camera", back_populates="user_access")

    def __repr__(self) -> str:
        return f"<Access user={self.user_id} camera={self.camera_id}>"
