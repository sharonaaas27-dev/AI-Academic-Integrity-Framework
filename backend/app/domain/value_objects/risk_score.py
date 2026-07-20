from dataclasses import dataclass, field
from typing import Optional
from uuid import UUID
from datetime import datetime
from ..enums import RiskLevel


@dataclass
class RiskScoreComponents:
    rule_score: float = 0.0
    ml_score: float = 0.0
    context_score: float = 0.0


@dataclass
class PredictionResult:
    model_name: str
    model_version: str
    anomaly_score: float
    confidence: float
    is_anomaly: bool
    probability: float


@dataclass
class RiskScore:
    exam_id: UUID
    student_id: UUID
    institution_id: UUID
    overall_score: float
    risk_level: RiskLevel
    components: RiskScoreComponents
    prediction: Optional[PredictionResult] = None
    rule_triggers: list[dict] = field(default_factory=list)
    top_features: list[dict] = field(default_factory=list)
    confidence: float = 0.0
    generated_at: datetime = field(default_factory=datetime.utcnow)

    @classmethod
    def from_score(cls, score: float) -> RiskLevel:
        if score <= 20:
            return RiskLevel.SAFE
        elif score <= 40:
            return RiskLevel.LOW
        elif score <= 60:
            return RiskLevel.MEDIUM
        elif score <= 80:
            return RiskLevel.HIGH
        else:
            return RiskLevel.CRITICAL

    def to_dict(self) -> dict:
        return {
            "exam_id": str(self.exam_id),
            "student_id": str(self.student_id),
            "institution_id": str(self.institution_id),
            "overall_score": self.overall_score,
            "risk_level": self.risk_level.value,
            "components": {
                "rule_score": self.components.rule_score,
                "ml_score": self.components.ml_score,
                "context_score": self.components.context_score,
            },
            "prediction": {
                "model_name": self.prediction.model_name,
                "model_version": self.prediction.model_version,
                "anomaly_score": self.prediction.anomaly_score,
                "confidence": self.prediction.confidence,
                "is_anomaly": self.prediction.is_anomaly,
                "probability": self.prediction.probability,
            }
            if self.prediction
            else None,
            "rule_triggers": self.rule_triggers,
            "top_features": self.top_features,
            "confidence": self.confidence,
            "generated_at": self.generated_at.isoformat(),
        }
