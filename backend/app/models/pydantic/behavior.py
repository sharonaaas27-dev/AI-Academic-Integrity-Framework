from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Any
from uuid import UUID
from datetime import datetime
from ...domain.enums import EventType


class BehaviorEventCreate(BaseModel):
    event_type: str = Field(..., min_length=1, max_length=64)
    timestamp: float = Field(..., ge=0, le=9999999999999)
    data: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class BehaviorBatchCreate(BaseModel):
    batch_id: str = Field(default="", max_length=64)
    exam_id: Optional[str] = Field(default=None, max_length=64)
    student_id: Optional[str] = Field(default=None, max_length=64)
    session_id: Optional[str] = Field(default=None, max_length=128)
    events: list[BehaviorEventCreate] = Field(..., min_length=1, max_length=500)
    client_sent_at: float = Field(default=0.0, ge=0, le=9999999999999)


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
