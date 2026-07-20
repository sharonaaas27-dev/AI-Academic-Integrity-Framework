"""
Rule Engine

Configurable rules that trigger risk score increments based on behavior events.
Rules are stored in the database and are editable from the admin dashboard.

Each rule has:
  - name: Human-readable name
  - condition: Dict with field, operator, value
  - score_increment: Points to add when triggered
  - category: Type of behavior (focus, clipboard, navigation, etc.)
"""

import logging
import json
from typing import Optional
from pathlib import Path

from ...core.config import settings
from ...core.cache import cache
from ...domain.enums import FeatureName

logger = logging.getLogger(__name__)


class RuleCondition:
    """Represents a single rule condition."""

    def __init__(self, condition_dict: dict):
        self.field = condition_dict.get("field", "")
        self.operator = condition_dict.get("operator", "gt")
        self.value = condition_dict.get("value", 0)
        self.logical = condition_dict.get("logical", "and")
        self.conditions = [
            RuleCondition(c) for c in condition_dict.get("conditions", [])
        ]

    def evaluate(self, features: dict[str, float]) -> bool:
        if self.conditions:
            if self.logical == "and":
                return all(c.evaluate(features) for c in self.conditions)
            elif self.logical == "or":
                return any(c.evaluate(features) for c in self.conditions)

        feature_value = features.get(self.field, 0.0)

        if self.operator == "gt":
            return feature_value > self.value
        elif self.operator == "gte":
            return feature_value >= self.value
        elif self.operator == "lt":
            return feature_value < self.value
        elif self.operator == "lte":
            return feature_value <= self.value
        elif self.operator == "eq":
            return feature_value == self.value
        elif self.operator == "neq":
            return feature_value != self.value
        elif self.operator == "between":
            if isinstance(self.value, list) and len(self.value) == 2:
                return self.value[0] <= feature_value <= self.value[1]
            return False
        return False


class Rule:
    """Represents a configurable rule."""

    def __init__(self, rule_dict: dict):
        self.id = rule_dict.get("id", "")
        self.name = rule_dict.get("name", "Unnamed Rule")
        self.description = rule_dict.get("description", "")
        self.condition = RuleCondition(rule_dict.get("condition", {}))
        self.score_increment = float(rule_dict.get("score_increment", 0))
        self.category = rule_dict.get("category", "general")
        self.priority = int(rule_dict.get("priority", 0))
        self.is_active = bool(rule_dict.get("is_active", True))

    def evaluate(self, features: dict[str, float]) -> dict:
        """Evaluate the rule and return result."""
        triggered = self.condition.evaluate(features)

        return {
            "rule_id": self.id,
            "rule_name": self.name,
            "category": self.category,
            "triggered": triggered,
            "score_increment": self.score_increment if triggered else 0.0,
            "condition": {
                "field": self._get_field_name(self.condition),
                "operator": self.condition.operator,
                "value": self.condition.value,
            },
        }

    def _get_field_name(self, condition: RuleCondition) -> str:
        if condition.conditions:
            return f"({condition.logical})"
        return condition.field


class RuleEngine:
    """
    Evaluates all active rules against the engineered features.
    Returns a list of triggered rules and the total rule-based score.
    """

    def __init__(self):
        self._rules: list[Rule] = []
        self._default_rules_path = Path(__file__).parent / "default_rules.json"

    async def load_rules(self) -> None:
        """Load rules from default JSON file."""
        if self._default_rules_path.exists():
            with open(self._default_rules_path) as f:
                rules_data = json.load(f)
                self._rules = [Rule(r) for r in rules_data.get("rules", [])]
            logger.info("Loaded %d default rules", len(self._rules))
        else:
            self._rules = self._get_default_rules()
            self._save_default_rules()
            logger.info("Created %d default rules", len(self._rules))

    def set_rules(self, rules: list[Rule]) -> None:
        self._rules = rules

    def get_rules(self) -> list[Rule]:
        return self._rules

    def evaluate(self, features: dict[str, float]) -> dict:
        """
        Evaluate all active rules against features.

        Returns:
        {
            "total_score": float (0-100),
            "triggered_rules": list of triggered rule results,
            "rule_breakdown": list of all rule evaluations,
        }
        """
        if not self._rules:
            return {
                "total_score": 0.0,
                "triggered_rules": [],
                "rule_breakdown": [],
            }

        # Sort by priority (higher first)
        sorted_rules = sorted(
            [r for r in self._rules if r.is_active],
            key=lambda r: r.priority,
            reverse=True,
        )

        total_score = 0.0
        triggered_rules = []
        rule_breakdown = []

        for rule in sorted_rules:
            result = rule.evaluate(features)
            rule_breakdown.append(result)
            if result["triggered"]:
                total_score += result["score_increment"]
                triggered_rules.append(result)

        # Normalize to 0-100
        normalized_score = min(total_score, 100.0)

        return {
            "total_score": normalized_score,
            "triggered_rules": triggered_rules,
            "rule_breakdown": rule_breakdown,
        }

    def _get_default_rules(self) -> list[Rule]:
        """Return built-in default rules."""
        rules_data = [
            {
                "id": "rule_paste_detected",
                "name": "Paste Detected",
                "description": "Student used paste during exam",
                "condition": {
                    "field": FeatureName.PASTE_COUNT.value,
                    "operator": "gt",
                    "value": 0,
                },
                "score_increment": 30,
                "category": "clipboard",
                "priority": 10,
                "is_active": True,
            },
            {
                "id": "rule_copy_detected",
                "name": "Copy Detected",
                "description": "Student used copy during exam",
                "condition": {
                    "field": FeatureName.COPY_COUNT.value,
                    "operator": "gt",
                    "value": 0,
                },
                "score_increment": 20,
                "category": "clipboard",
                "priority": 9,
                "is_active": True,
            },
            {
                "id": "rule_excessive_focus_switches",
                "name": "Excessive Focus Switches",
                "description": "Student switched focus more than 5 times",
                "condition": {
                    "field": FeatureName.FOCUS_SWITCH_COUNT.value,
                    "operator": "gt",
                    "value": 5,
                },
                "score_increment": 20,
                "category": "focus",
                "priority": 8,
                "is_active": True,
            },
            {
                "id": "rule_devtools_opened",
                "name": "Developer Tools Opened",
                "description": "Student opened browser developer tools",
                "condition": {
                    "field": FeatureName.DEVTOOL_ATTEMPT_COUNT.value,
                    "operator": "gt",
                    "value": 0,
                },
                "score_increment": 40,
                "category": "devtools",
                "priority": 10,
                "is_active": True,
            },
            {
                "id": "rule_multiple_fullscreen_exits",
                "name": "Multiple Fullscreen Exits",
                "description": "Student exited fullscreen mode 3+ times",
                "condition": {
                    "field": FeatureName.FULLSCREEN_EXIT_COUNT.value,
                    "operator": "gte",
                    "value": 3,
                },
                "score_increment": 25,
                "category": "fullscreen",
                "priority": 7,
                "is_active": True,
            },
            {
                "id": "rule_high_idle_ratio",
                "name": "High Idle Ratio",
                "description": "Student was idle for more than 30% of exam time",
                "condition": {
                    "field": FeatureName.IDLE_RATIO.value,
                    "operator": "gt",
                    "value": 0.3,
                },
                "score_increment": 15,
                "category": "idle",
                "priority": 5,
                "is_active": True,
            },
            {
                "id": "rule_frequent_question_switching",
                "name": "Frequent Question Switching",
                "description": "Student switched questions more than 10 times",
                "condition": {
                    "field": FeatureName.QUESTION_SWITCH_FREQUENCY.value,
                    "operator": "gt",
                    "value": 10,
                },
                "score_increment": 10,
                "category": "navigation",
                "priority": 4,
                "is_active": True,
            },
            {
                "id": "rule_excessive_answer_edits",
                "name": "Excessive Answer Edits",
                "description": "Student edited answers more than 5 times",
                "condition": {
                    "field": FeatureName.ANSWER_EDIT_COUNT.value,
                    "operator": "gt",
                    "value": 5,
                },
                "score_increment": 10,
                "category": "answers",
                "priority": 4,
                "is_active": True,
            },
            {
                "id": "rule_network_instability",
                "name": "Network Instability",
                "description": "Student experienced multiple network disconnects",
                "condition": {
                    "field": FeatureName.NETWORK_DISCONNECT_COUNT.value,
                    "operator": "gt",
                    "value": 3,
                },
                "score_increment": 15,
                "category": "network",
                "priority": 6,
                "is_active": True,
            },
            {
                "id": "rule_missing_heartbeats",
                "name": "Missing Heartbeats",
                "description": "Student missed more than 20% of heartbeats",
                "condition": {
                    "field": FeatureName.HEARTBEAT_MISS_RATIO.value,
                    "operator": "gt",
                    "value": 0.2,
                },
                "score_increment": 20,
                "category": "connection",
                "priority": 7,
                "is_active": True,
            },
        ]
        return [Rule(r) for r in rules_data]

    def _save_default_rules(self) -> None:
        """Save rules to JSON file for persistence."""
        rules_data = {
            "version": "1.0",
            "rules": [
                {
                    "id": r.id,
                    "name": r.name,
                    "description": r.description,
                    "condition": self._rule_to_dict(r.condition),
                    "score_increment": r.score_increment,
                    "category": r.category,
                    "priority": r.priority,
                    "is_active": r.is_active,
                }
                for r in self._rules
            ],
        }
        with open(self._default_rules_path, "w") as f:
            json.dump(rules_data, f, indent=2)

    def _rule_to_dict(self, condition: RuleCondition) -> dict:
        result = {
            "field": condition.field,
            "operator": condition.operator,
            "value": condition.value,
        }
        if condition.conditions:
            result["logical"] = condition.logical
            result["conditions"] = [self._rule_to_dict(c) for c in condition.conditions]
        return result


rule_engine = RuleEngine()
