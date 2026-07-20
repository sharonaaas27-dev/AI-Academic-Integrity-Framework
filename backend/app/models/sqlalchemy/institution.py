import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, JSON, DateTime, Text
from sqlalchemy import Uuid as UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional

from .base import Base, TimestampMixin, SoftDeleteMixin


class Institution(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "institutions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_users: Mapped[Optional[int]] = mapped_column(nullable=True)
    subscription_tier: Mapped[str] = mapped_column(String(50), default="free")
    contact_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    users = relationship("User", back_populates="institution", lazy="selectin")
    courses = relationship("Course", back_populates="institution", lazy="selectin")
    exams = relationship("Exam", back_populates="institution", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Institution {self.name} ({self.slug})>"
