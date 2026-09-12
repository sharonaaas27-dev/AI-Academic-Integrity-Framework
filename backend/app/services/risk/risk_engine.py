"""
Risk Scoring Engine

Combines rule-based scoring, ML predictions, and exam context
to generate an overall 0-100 risk score with explainability.

Risk Score Formula:
    RiskScore = α × S_rules + β × S_ml + γ × S_context

Where:
    S_rules   = normalized rule-based score (0-100)
    S_ml      = anomaly score from ML ensemble (0-100)
    S_context = exam context score based on difficulty, time remaining

    α, β, γ are configurable weights (default: 0.3, 0.5, 0.2)
"""

import logging
from typing import Optional, Any
from uuid import UUID
from datetime import datetime

try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    np = None
    HAS_NUMPY = False

from ...core.config import settings
from ...domain.value_objects.risk_score import (
    RiskScore,
    RiskScoreComponents,
    PredictionResult,
)
from ...domain.enums import RiskLevel
from ..rule_engine.rule_engine import rule_engine
from ..ml.ml_engine import model_registry
from ..feature_engineering.feature_engine import feature_engine

logger = logging.getLogger(__name__)


class RiskEngine:
    """
    Orchestrates the full risk scoring pipeline:
    Features -> Rules -> ML -> Context -> Combined Score -> Explainability
    """

    def __init__(self):
        self.alpha = settings.RISK_WEIGHT_RULES
        self.beta = settings.RISK_WEIGHT_ML
        self.gamma = settings.RISK_WEIGHT_CONTEXT

    async def calculate_risk(
        self,
        exam_id: UUID,
        student_id: UUID,
        institution_id: UUID,
        features: dict[str, float],
        exam_difficulty: str = "medium",
        time_remaining_percent: float = 0.5,
        exam_duration_seconds: Optional[float] = None,
    ) -> RiskScore:
        """
        Calculate comprehensive risk score for a student.

        Args:
            exam_id: The exam being taken
            student_id: The student being evaluated
            institution_id: The institution
            features: Engineered behavioral features
            exam_difficulty: easy/medium/hard
            time_remaining_percent: 0.0 (just started) to 1.0 (time's up)
            exam_duration_seconds: Total exam duration

        Returns:
            RiskScore with full breakdown
        """
        # 1. Rule-based scoring
        rule_result = await self._evaluate_rules(features)

        # 2. ML-based scoring
        ml_result = await self._predict_ml(features)

        # 3. Context scoring
        context_score = self._calculate_context_score(
            exam_difficulty, time_remaining_percent
        )

        # 4. Combine scores
        components = RiskScoreComponents(
            rule_score=rule_result["total_score"],
            ml_score=ml_result.anomaly_score * 100 if ml_result else 0.0,
            context_score=context_score,
        )

        overall_score = (
            self.alpha * components.rule_score
            + self.beta * components.ml_score
            + self.gamma * components.context_score
        )
        overall_score = min(max(overall_score, 0.0), 100.0)

        risk_level = RiskScore.from_score(overall_score)

        # 5. Build risk score object
        risk_score = RiskScore(
            exam_id=exam_id,
            student_id=student_id,
            institution_id=institution_id,
            overall_score=round(overall_score, 2),
            risk_level=risk_level,
            components=components,
            prediction=ml_result,
            rule_triggers=rule_result["triggered_rules"],
            top_features=self._get_top_features(features),
            confidence=ml_result.confidence if ml_result else 0.0,
        )

        logger.info(
            "Risk calculated: student=%s exam=%s score=%.2f level=%s",
            student_id, exam_id, overall_score, risk_level.value,
        )

        return risk_score

    async def _evaluate_rules(self, features: dict[str, float]) -> dict:
        """Evaluate all active rules against features."""
        try:
            return rule_engine.evaluate(features)
        except Exception as e:
            logger.error("Rule evaluation failed: %s", str(e))
            return {
                "total_score": 0.0,
                "triggered_rules": [],
                "rule_breakdown": [],
            }

    async def _predict_ml(self, features: dict[str, float]) -> Optional[PredictionResult]:
        """Get ML prediction for the features."""
        if not HAS_NUMPY:
            return None
        try:
            model = await model_registry.get("ensemble_default")
            if not model:
                logger.warning("No ML model available for prediction")
                return None

            # Use the model's own preprocess so feature order always matches
            # training (metadata.feature_columns), never sorted(dict) order.
            feature_array = model.preprocess(features)
            anomaly_scores = await model.predict(feature_array)
            probas = await model.predict_proba(feature_array)

            anomaly_score = float(anomaly_scores[0])
            probability = float(probas[0][1]) if probas.shape[1] > 1 else float(probas[0][0])

            # Normalize anomaly score to 0-1
            normalized_score = 1.0 / (1.0 + np.exp(-anomaly_score)) if anomaly_score != 0 else 0.5

            confidence = max(probability, 1.0 - probability) if probability != 0.5 else 0.5
            is_anomaly = probability > settings.ML_CONFIDENCE_THRESHOLD

            return PredictionResult(
                model_name=model.metadata.name,
                model_version=model.metadata.version,
                anomaly_score=round(normalized_score, 4),
                confidence=round(confidence, 4),
                is_anomaly=is_anomaly,
                probability=round(probability, 4),
            )
        except Exception as e:
            logger.error("ML prediction failed: %s", str(e))
            return None

    def _calculate_context_score(
        self,
        difficulty: str,
        time_remaining_percent: float,
    ) -> float:
        """
        Calculate context-based score.

        Factors:
        - Exam difficulty: harder exams have slightly higher context weight
        - Time remaining: suspicious behavior near end of exam is less concerning
          (could be rushing), suspicious behavior early is more concerning
        """
        difficulty_map = {"easy": 0.0, "medium": 10.0, "hard": 20.0}
        base_difficulty = difficulty_map.get(difficulty, 10.0)

        # Time factor: more weight early in exam
        # At 0% time remaining (just started): weight = 1.0
        # At 100% time remaining (ending): weight = 0.0
        time_factor = 1.0 - time_remaining_percent

        # Quick answer speed could be suspicious
        if time_remaining_percent > 0.8:
            # Very early in exam, suspicious behavior is more concerning
            time_factor = 1.0 - time_remaining_percent
            return min(base_difficulty + (20.0 * time_factor), 50.0)
        elif time_remaining_percent < 0.2:
            # Near end of exam, less concerning
            return min(base_difficulty * 0.5, 20.0)

        return base_difficulty

    def _get_top_features(
        self,
        features: dict[str, float],
        top_n: int = 5,
    ) -> list[dict]:
        """Get the top contributing features for explainability."""
        sorted_features = sorted(
            features.items(),
            key=lambda x: abs(x[1]),
            reverse=True,
        )
        return [
            {"name": name, "value": value}
            for name, value in sorted_features[:top_n]
        ]

    def update_weights(
        self,
        alpha: Optional[float] = None,
        beta: Optional[float] = None,
        gamma: Optional[float] = None,
    ) -> None:
        """Update risk score weights (must sum to ~1.0)."""
        new_alpha = alpha if alpha is not None else self.alpha
        new_beta = beta if beta is not None else self.beta
        new_gamma = gamma if gamma is not None else self.gamma
        total = new_alpha + new_beta + new_gamma
        if abs(total - 1.0) > 0.01:
            raise ValueError(f"Risk weights must sum to 1.0, got {total:.3f}")
        self.alpha, self.beta, self.gamma = new_alpha, new_beta, new_gamma
        logger.info(
            "Risk weights updated: alpha=%.2f beta=%.2f gamma=%.2f",
            self.alpha, self.beta, self.gamma,
        )


risk_engine = RiskEngine()
