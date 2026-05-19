"""
SQLAlchemy Event model.
Stores AI detection events (person_detected, camera_offline).
"""

import uuid
import enum
from datetime import datetime

from sqlalchemy import String, Enum, ForeignKey, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from database import Base


class EventType(str, enum.Enum):
    person_detected = "person_detected"
    camera_offline = "camera_offline"


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("idx_events_camera_time", "camera_id", "created_at"),
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
    event_type: Mapped[EventType] = mapped_column(
        Enum(EventType, name="event_type_enum", create_constraint=True),
        nullable=False,
    )
    snapshot_minio_key: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now()
    )

    # ── Relationships ─────────────────────────────────────────
    camera = relationship("Camera", back_populates="events")

    def __repr__(self) -> str:
        return f"<Event {self.event_type.value} camera={self.camera_id}>"
