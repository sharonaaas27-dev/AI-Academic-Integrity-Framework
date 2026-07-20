import uuid
from datetime import datetime, timezone
from sqlalchemy import String, JSON, ForeignKey, Enum as SAEnum, DateTime
from sqlalchemy import Uuid as UUID
from sqlalchemy.orm import Mapped, mapped_column
from typing import Optional

from .base import Base, TimestampMixin


class InstitutionSettings(Base, TimestampMixin):
    __tablename__ = "institution_settings"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institutions.id"), unique=True, nullable=False
    )
    settings_key: Mapped[str] = mapped_column(String(100), nullable=False)
    settings_value: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    def __repr__(self) -> str:
        return f"<InstitutionSettings {self.settings_key}>"


class MLModelRegistry(Base, TimestampMixin):
    __tablename__ = "ml_model_registry"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institutions.id"), nullable=False, index=True
    )
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    model_version: Mapped[str] = mapped_column(String(50), nullable=False)
    model_type: Mapped[str] = mapped_column(String(50), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(500), nullable=False)
    metrics: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    is_active: Mapped[bool] = mapped_column(default=False, nullable=False)
    config: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    deployed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    deployed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<MLModel {self.model_name} v{self.model_version}>"
