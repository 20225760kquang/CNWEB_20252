"""
SQLAlchemy Recording model.
Status: recording | completed | expired
"""

import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Integer, BigInteger, Enum, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP

from database import Base


class RecordingStatus(str, enum.Enum):
    recording = "recording"
    completed = "completed"
    expired = "expired"


class Recording(Base):
    __tablename__ = "recordings"
    __table_args__ = (
        Index("idx_recordings_camera_time", "camera_id", "start_time"),
        Index("idx_recordings_status", "status"),
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
    start_time: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    end_time: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    # bucket hiểu như collection của MongoDB, playlist là nơi chứa các key của các phân đoạn video, có thể lấy key để ghép lại hoặc tải về
    minio_bucket: Mapped[str] = mapped_column(
        String(100), default="recordings"
    )
    minio_playlist_key: Mapped[str] = mapped_column(
        String(500), nullable=False
    )
    file_size_bytes: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True
    )
    duration_seconds: Mapped[int] = mapped_column(
        Integer, default=3600
    )
    status: Mapped[RecordingStatus] = mapped_column(
        Enum(RecordingStatus, name="recording_status", create_constraint=True),
        default=RecordingStatus.recording,
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )

    # ── Relationships ─────────────────────────────────────────
    camera = relationship("Camera", back_populates="recordings")
    clip_exports = relationship(
        "ClipExport", back_populates="recording", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Recording {self.id} ({self.status.value})>"
