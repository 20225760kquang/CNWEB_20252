"""
SQLAlchemy ClipExport model.
Status: processing | ready | expired
"""

import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, TIMESTAMP

from database import Base


class ExportStatus(str, enum.Enum):
    processing = "processing"
    ready = "ready"
    expired = "expired"


class ClipExport(Base):
    __tablename__ = "clip_exports"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    recording_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recordings.id", ondelete="CASCADE"),
        nullable=False,
    )
    clip_start: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    clip_end: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    minio_key: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    status: Mapped[ExportStatus] = mapped_column(
        Enum(ExportStatus, name="export_status", create_constraint=True),
        default=ExportStatus.processing,
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )

    # ── Relationships ─────────────────────────────────────────
    user = relationship("User", back_populates="clip_exports")
    recording = relationship("Recording", back_populates="clip_exports")

    def __repr__(self) -> str:
        return f"<ClipExport {self.id} ({self.status.value})>"
