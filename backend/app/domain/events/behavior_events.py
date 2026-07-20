from dataclasses import dataclass, field, asdict
from typing import Optional, Any
from uuid import uuid4, UUID
from datetime import datetime
from ..enums import EventType


@dataclass
class BehaviorEvent:
    event_id: str = field(default_factory=lambda: str(uuid4()))
    exam_id: Optional[str] = None
    student_id: Optional[str] = None
    session_id: Optional[str] = None
    event_type: Optional[str] = None
    timestamp: float = 0.0
    data: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "exam_id": self.exam_id,
            "student_id": self.student_id,
            "session_id": self.session_id,
            "event_type": self.event_type,
            "timestamp": self.timestamp,
            "data": self.data,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "BehaviorEvent":
        return cls(
            event_id=data.get("event_id", str(uuid4())),
            exam_id=data.get("exam_id"),
            student_id=data.get("student_id"),
            session_id=data.get("session_id"),
            event_type=data.get("event_type"),
            timestamp=data.get("timestamp", 0.0),
            data=data.get("data", {}),
            metadata=data.get("metadata", {}),
        )


@dataclass
class EventBatch:
    batch_id: str = field(default_factory=lambda: str(uuid4()))
    exam_id: Optional[str] = None
    student_id: Optional[str] = None
    session_id: Optional[str] = None
    events: list[BehaviorEvent] = field(default_factory=list)
    client_sent_at: float = 0.0
    server_received_at: float = field(default_factory=lambda: datetime.utcnow().timestamp())

    def add_event(self, event: BehaviorEvent) -> None:
        self.events.append(event)

    def to_dict(self) -> dict:
        return {
            "batch_id": self.batch_id,
            "exam_id": self.exam_id,
            "student_id": self.student_id,
            "session_id": self.session_id,
            "event_count": len(self.events),
            "events": [e.to_dict() for e in self.events],
            "client_sent_at": self.client_sent_at,
            "server_received_at": self.server_received_at,
        }
