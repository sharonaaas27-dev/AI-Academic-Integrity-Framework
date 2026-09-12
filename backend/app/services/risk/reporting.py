"""
Report persistence extras shared by all RiskReport save paths.

- SHAP enrichment of ``top_features`` (optional, flag-gated).
- Calibration sample rows: the raw material for future per-exam-type
  threshold tuning (features + score + difficulty context per report).
"""

import logging
from typing import Any, Optional
from uuid import UUID

logger = logging.getLogger(__name__)


async def enrich_top_features(
    features: dict[str, float],
    top_features: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Add optional SHAP contributions; always safe to call (no-op when off)."""
    try:
        from ..explainable_ai.shap_attribution import (
            attribute_risk,
            merge_shap_into_top_features,
        )

        shap_values = await attribute_risk(features)
        return merge_shap_into_top_features(top_features, shap_values)
    except Exception:
        logger.debug("SHAP enrichment skipped", exc_info=True)
        return top_features


def calibration_sample_kwargs(
    *,
    exam_id: UUID,
    institution_id: UUID,
    report_id: UUID,
    exam_difficulty: str,
    features: dict[str, float],
    overall_score: float,
    risk_level: str,
    rule_score: float,
    ml_score: float,
    context_score: float,
) -> dict[str, Any]:
    from ...models.sqlalchemy.risk import RiskCalibrationSample

    return {
        "_model": RiskCalibrationSample,
        "exam_id": exam_id,
        "institution_id": institution_id,
        "report_id": report_id,
        "exam_difficulty": exam_difficulty or "medium",
        "features": dict(features),
        "overall_score": overall_score,
        "risk_level": risk_level,
        "rule_score": rule_score,
        "ml_score": ml_score,
        "context_score": context_score,
    }


async def save_calibration_sample(db: Any, sample_kwargs: dict[str, Any]) -> None:
    """Insert a calibration row; never fails the parent transaction's purpose.

    Runs inside the caller's commit — on error it logs and rolls back only
    the sample by using a nested transaction.
    """
    model = sample_kwargs.pop("_model")
    try:
        async with db.begin_nested():
            db.add(model(**sample_kwargs))
    except Exception:
        logger.warning("Calibration sample insert skipped", exc_info=True)
