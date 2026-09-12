"""
Scoped SHAP attribution for tree models (RandomForest / XGBoost).

Design constraints (why "scoped"):
- ``shap`` is a heavy optional dependency: it lives only in
  requirements-full/local, and everything here degrades to ``None`` when
  the package, the models, or the ``SHAP_ENABLED`` flag is missing — the
  template explainer remains the default.
- Attribution runs once per saved RiskReport (report-save path), never per
  event batch, so TreeSHAP cost stays off the hot loop.
- Results merge into ``top_features`` entries as an optional ``"shap"``
  key — readers of ``{"name", "value"}`` are unaffected.
"""

import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


def shap_available() -> bool:
    try:
        import shap  # noqa: F401
        return True
    except ImportError:
        return False


async def attribute_risk(
    features: dict[str, float],
    top_n: int = 5,
) -> Optional[list[dict[str, Any]]]:
    """Return per-feature SHAP contributions, or None when unavailable.

    Output: [{"name": str, "shap_value": float}] sorted by |contribution|.
    Positive values push the prediction toward the anomalous class.
    """
    from ...core.config import settings

    if not settings.SHAP_ENABLED:
        return None
    if not shap_available():
        logger.debug("SHAP requested but package not installed")
        return None

    try:
        import numpy as np
        import shap as shap_pkg

        from ..ml.ml_engine import model_registry

        model = await model_registry.get("ensemble_default")
        if model is None or not hasattr(model, "models"):
            return None

        contributions: dict[str, float] = {}
        counts: dict[str, int] = {}
        for sub in model.models:
            raw = getattr(sub, "model", None)
            if raw is None or not hasattr(raw, "predict"):
                continue
            cols = (getattr(sub.metadata, "feature_columns", None)
                    or sorted(features.keys()))
            vector = np.array([[float(features.get(c, 0.0)) for c in cols]])
            try:
                explainer = shap_pkg.TreeExplainer(raw)
                values = explainer.shap_values(vector)
            except Exception as e:
                logger.debug("SHAP explainer failed for %s: %s",
                             getattr(sub.metadata, "name", "?"), e)
                continue
            # Binary classifiers return [class0, class1]; take anomalous class.
            if isinstance(values, list):
                values = values[1] if len(values) > 1 else values[0]
            import numpy as _np
            row = _np.asarray(values).reshape(-1)
            for i, col in enumerate(cols):
                if i < len(row):
                    contributions[col] = contributions.get(col, 0.0) + float(row[i])
                    counts[col] = counts.get(col, 0) + 1

        if not contributions:
            return None
        averaged = [
            {"name": k, "shap_value": round(v / counts[k], 4)}
            for k, v in contributions.items()
        ]
        averaged.sort(key=lambda d: abs(d["shap_value"]), reverse=True)
        return averaged[:top_n]
    except Exception:
        logger.exception("SHAP attribution failed; falling back to template explanation")
        return None


def merge_shap_into_top_features(
    top_features: list[dict[str, Any]],
    shap_values: Optional[list[dict[str, Any]]],
) -> list[dict[str, Any]]:
    """Add optional ``shap`` keys to top_features entries (non-breaking)."""
    if not shap_values:
        return top_features
    by_name = {s["name"]: s["shap_value"] for s in shap_values}
    return [
        {**f, "shap": by_name[f["name"]]} if f.get("name") in by_name else f
        for f in top_features
    ]
