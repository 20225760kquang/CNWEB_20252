"""
SQLAlchemy Snapshot model.
User-initiated screenshots from live or playback.
"""

import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP

from database import Base


class Snapshot(Base):
    __tablename__ = "snapshots"
    __table_args__ = (
        Index("idx_snapshots_camera", "camera_id", "captured_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    camera_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("cameras.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    captured_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        server_default=func.now(),
    )
    minio_key: Mapped[str] = mapped_column(
        String(500), nullable=False
    )
    source: Mapped[str] = mapped_column(
        String(20), default="live"  # "live" | "playback"
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )

    # ── Relationships ─────────────────────────────────────────
    camera = relationship("Camera", back_populates="snapshots")
    user = relationship("User", back_populates="snapshots")

    def __repr__(self) -> str:
        return f"<Snapshot {self.id} source={self.source}>"
