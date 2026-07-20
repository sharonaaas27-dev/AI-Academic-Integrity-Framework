"""Tests for the rule engine."""

import pytest
from app.services.rule_engine.rule_engine import RuleEngine, Rule, RuleCondition
from app.domain.enums import FeatureName


class TestRuleEngine:
    @pytest.fixture
    def engine(self):
        engine = RuleEngine()
        return engine

    def test_evaluate_no_rules(self, engine):
        result = engine.evaluate({"some_feature": 10.0})
        assert result["total_score"] == 0.0
        assert result["triggered_rules"] == []

    def test_paste_rule_triggered(self, engine):
        engine._rules = engine._get_default_rules()
        features = {FeatureName.PASTE_COUNT.value: 1.0}
        result = engine.evaluate(features)

        assert result["total_score"] >= 20.0
        triggered_names = [r["rule_name"] for r in result["triggered_rules"]]
        assert "Paste Detected" in triggered_names

    def test_devtools_rule_high_priority(self, engine):
        engine._rules = engine._get_default_rules()
        features = {
            FeatureName.DEVTOOL_ATTEMPT_COUNT.value: 1.0,
            FeatureName.PASTE_COUNT.value: 1.0,
        }
        result = engine.evaluate(features)

        # DevTools rule has higher increment
        devtools_rule = next(
            r for r in result["triggered_rules"]
            if r["rule_name"] == "Developer Tools Opened"
        )
        assert devtools_rule["score_increment"] == 40.0

    def test_score_normalization(self, engine):
        engine._rules = engine._get_default_rules()
        features = {
            FeatureName.PASTE_COUNT.value: 1.0,
            FeatureName.COPY_COUNT.value: 1.0,
            FeatureName.DEVTOOL_ATTEMPT_COUNT.value: 1.0,
            FeatureName.FOCUS_SWITCH_COUNT.value: 10.0,
        }
        result = engine.evaluate(features)
        assert result["total_score"] <= 100.0

    def test_rule_condition_evaluation(self):
        condition = RuleCondition({
            "field": "test_field",
            "operator": "gt",
            "value": 5,
        })
        assert condition.evaluate({"test_field": 10.0})
        assert not condition.evaluate({"test_field": 3.0})
        assert not condition.evaluate({"test_field": 5.0})
