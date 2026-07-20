from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Any
from uuid import UUID
from datetime import datetime
from ...domain.enums import EventType


class BehaviorEventCreate(BaseModel):
    event_type: str
    timestamp: float
    data: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class BehaviorBatchCreate(BaseModel):
    batch_id: str = ""
    exam_id: Optional[str] = None
    student_id: Optional[str] = None
    session_id: Optional[str] = None
    events: list[BehaviorEventCreate]
    client_sent_at: float = 0.0


class BehaviorEventResponse(BaseModel):
    id: UUID
    event_type: str
    event_data: dict
    client_timestamp: float
    server_timestamp: float

    model_config = ConfigDict(from_attributes=True)


class BehaviorTimelineResponse(BaseModel):
    exam_id: UUID
    student_id: UUID
    timeline: list[dict]
    summary: Optional[dict] = None


class ProcessedFeatureResponse(BaseModel):
    id: UUID
    exam_id: UUID
    student_id: UUID
    features: dict
    window_start: float
    window_end: float
    event_count: int

    model_config = ConfigDict(from_attributes=True)
