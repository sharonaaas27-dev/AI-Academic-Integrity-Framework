from pydantic import BaseModel, Field
from typing import Optional, Any
from uuid import UUID
from datetime import datetime


class DashboardStats(BaseModel):
    total_exams: int = 0
    total_students: int = 0
    total_institutions: int = 0
    active_exams: int = 0
    high_risk_reports: int = 0
    recent_events_per_hour: int = 0


class CreateUserRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=8)
    first_name: str
    last_name: str
    role: str = "student"
    institution_id: UUID


class UpdateRuleRequest(BaseModel):
    name: Optional[str] = None
    score_increment: Optional[float] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None
    condition: Optional[dict] = None


class RiskOverviewResponse(BaseModel):
    distribution: dict[str, int]
    total_reports: int
    recent_flags: list[dict]


class SystemHealthResponse(BaseModel):
    status: str
    version: str
    uptime_seconds: int
    active_connections: int
    queue_size: int
    memory_usage_mb: float
