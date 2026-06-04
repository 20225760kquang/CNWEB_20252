from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from models.clip_export import ExportStatus

class ClipExportCreate(BaseModel):
    recording_id: UUID
    clip_start: datetime
    clip_end: datetime

class ClipExportResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    recording_id: UUID
    camera_name: str
    clip_start: datetime
    clip_end: datetime
    status: ExportStatus
    created_at: datetime
    download_url: Optional[str] = None

class ClipListResponse(BaseModel):
    clips: List[ClipExportResponse]
    total: int
