"""SHAP reporting: safe no-ops when disabled/missing, pure merge logic."""

import pytest

from app.services.explainable_ai.shap_attribution import (
    attribute_risk,
    merge_shap_into_top_features,
)
from app.services.risk.reporting import enrich_top_features


@pytest.mark.asyncio
async def test_attribute_risk_disabled_by_default():
    # SHAP_ENABLED=False in config -> always None, never imports shap.
    assert await attribute_risk({"paste_count": 3.0}) is None


def test_merge_is_backward_compatible():
    top = [{"name": "paste_count", "value": 3.0}, {"name": "focus", "value": 1.0}]
    # No SHAP values -> identical list content
    assert merge_shap_into_top_features(top, None) == top
    # With SHAP values -> only adds "shap" keys, keeps name/value
    merged = merge_shap_into_top_features(
        top, [{"name": "paste_count", "shap_value": 14.25}]
    )
    assert merged[0] == {"name": "paste_count", "value": 3.0, "shap": 14.25}
    assert merged[1] == {"name": "focus", "value": 1.0}


@pytest.mark.asyncio
async def test_enrich_top_features_noop_when_off():
    top = [{"name": "a", "value": 1.0}]
    assert await enrich_top_features({"a": 1.0}, top) == top
