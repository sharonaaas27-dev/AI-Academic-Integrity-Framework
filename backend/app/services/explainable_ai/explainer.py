"""
Explainable AI Service

Every prediction must explain:
  - Why the score was assigned
  - What evidence supports it
  - Confidence level
  - Top contributing features
  - Timeline of suspicious events

Generates human-readable explanations suitable for invigilator review.
"""

import logging
from typing import Optional
from datetime import datetime

from ...domain.value_objects.risk_score import RiskScore, RiskLevel
from ...domain.enums import FeatureName, EventType

logger = logging.getLogger(__name__)


class ExplainableAI:
    """
    Generates human-readable explanations for risk scores.
    """

    def generate_explanation(
        self,
        risk_score: RiskScore,
        features: dict[str, float],
        timeline_events: Optional[list[dict]] = None,
    ) -> dict:
        """
        Generate a comprehensive explanation for a risk score.

        Returns:
        {
            "summary": "Short human-readable summary",
            "risk_level": "high",
            "confidence": 0.85,
            "key_findings": [...],
            "evidence": [...],
            "top_features": [...],
            "timeline_summary": "...",
            "recommendation": "...",
        }
        """
        findings = self._generate_findings(risk_score, features)
        evidence = self._generate_evidence(risk_score)
        timeline_summary = self._summarize_timeline(timeline_events)
        recommendation = self._generate_recommendation(risk_score)

        summary_parts = []
        if risk_score.risk_level in (RiskLevel.HIGH, RiskLevel.CRITICAL):
            summary_parts.append(
                f"Student flagged at {risk_score.risk_level.value.upper()} risk "
                f"(score: {risk_score.overall_score:.1f}/100)."
            )
            if findings:
                summary_parts.append(f"Key concern: {findings[0]}")
        elif risk_score.risk_level == RiskLevel.MEDIUM:
            summary_parts.append(
                f"Student shows moderate risk indicators "
                f"(score: {risk_score.overall_score:.1f}/100)."
            )
        else:
            summary_parts.append(
                f"Student behavior appears normal "
                f"(score: {risk_score.overall_score:.1f}/100)."
            )

        return {
            "summary": " ".join(summary_parts),
            "risk_level": risk_score.risk_level.value,
            "risk_score": risk_score.overall_score,
            "confidence": risk_score.confidence,
            "key_findings": findings,
            "evidence": evidence,
            "rule_triggers": [
                {
                    "rule": r.get("rule_name", "Unknown"),
                    "reason": f"Rule triggered: {r.get('rule_name', 'Unknown')} "
                              f"(+{r.get('score_increment', 0)} points)",
                    "category": r.get("category", "general"),
                }
                for r in risk_score.rule_triggers
            ],
            "top_features": [
                {
                    "name": self._feature_display_name(f["name"]),
                    "value": f["value"],
                    "contribution": "high" if abs(f["value"]) > 0.5 else "medium",
                }
                for f in risk_score.top_features
            ],
            "timeline_summary": timeline_summary,
            "recommendation": recommendation,
            "generated_at": datetime.utcnow().isoformat(),
        }

    def _generate_findings(
        self,
        risk_score: RiskScore,
        features: dict[str, float],
    ) -> list[str]:
        """Generate bullet-point findings explaining the score."""
        findings = []

        # Rule-based findings
        for trigger in risk_score.rule_triggers:
            rule_name = trigger.get("rule_name", "")
            increment = trigger.get("score_increment", 0)
            findings.append(
                f"Behavior rule '{rule_name}' contributed +{increment:.0f} points"
            )

        # ML-based findings
        if risk_score.prediction:
            pred = risk_score.prediction
            if pred.is_anomaly:
                findings.append(
                    f"ML model ({pred.model_name}) detected anomalous behavior pattern "
                    f"(confidence: {pred.confidence:.1%})"
                )
            else:
                findings.append(
                    f"ML model ({pred.model_name}) found behavior within normal range "
                    f"(confidence: {pred.confidence:.1%})"
                )

        # Feature-based findings
        if features:
            paste_count = features.get(FeatureName.PASTE_COUNT.value, 0)
            if paste_count > 0:
                findings.append(f"Detected {int(paste_count)} paste operation(s)")

            devtool_count = features.get(FeatureName.DEVTOOL_ATTEMPT_COUNT.value, 0)
            if devtool_count > 0:
                findings.append(
                    f"Detected {int(devtool_count)} developer tool attempt(s)"
                )

            fullscreen_count = features.get(FeatureName.FULLSCREEN_EXIT_COUNT.value, 0)
            if fullscreen_count >= 3:
                findings.append(
                    f"Student exited fullscreen mode {int(fullscreen_count)} times"
                )

            focus_switches = features.get(FeatureName.FOCUS_SWITCH_COUNT.value, 0)
            if focus_switches > 5:
                findings.append(
                    f"Excessive focus switches: {int(focus_switches)} window blur events"
                )

        return findings

    def _generate_evidence(self, risk_score: RiskScore) -> list[dict]:
        """Generate structured evidence for the risk score."""
        evidence = []

        evidence.append({
            "type": "component_scores",
            "title": "Risk Component Breakdown",
            "details": {
                "Rule-based score": f"{risk_score.components.rule_score:.1f}/100",
                "ML anomaly score": f"{risk_score.components.ml_score:.1f}/100",
                "Context score": f"{risk_score.components.context_score:.1f}/100",
                "Final weighted score": f"{risk_score.overall_score:.1f}/100",
            },
        })

        if risk_score.prediction:
            evidence.append({
                "type": "ml_prediction",
                "title": "Machine Learning Analysis",
                "details": {
                    "Model": f"{risk_score.prediction.model_name} v{risk_score.prediction.model_version}",
                    "Anomaly Score": f"{risk_score.prediction.anomaly_score:.4f}",
                    "Confidence": f"{risk_score.prediction.confidence:.1%}",
                    "Prediction": "Anomalous" if risk_score.prediction.is_anomaly else "Normal",
                    "Probability": f"{risk_score.prediction.probability:.1%}",
                },
            })

        if risk_score.rule_triggers:
            evidence.append({
                "type": "rule_triggers",
                "title": "Triggered Rules",
                "details": {
                    t["rule_name"]: f"+{t['score_increment']} points ({t['category']})"
                    for t in risk_score.rule_triggers
                },
            })

        return evidence

    def _summarize_timeline(
        self,
        timeline_events: Optional[list[dict]],
    ) -> str:
        """Generate a human-readable timeline summary."""
        if not timeline_events:
            return "No significant timeline events recorded."

        suspicious_events = [
            e
            for e in timeline_events
            if e.get("event_type") in (
                EventType.KEY_PASTE.value,
                EventType.DEVTOOLS_OPEN.value,
                EventType.FULLSCREEN_EXIT.value,
                EventType.WINDOW_BLUR.value,
            )
        ]

        if not suspicious_events:
            return "No suspicious events in timeline."

        event_descriptions = []
        for event in suspicious_events[:10]:  # Limit to 10
            et = event.get("event_type", "")
            ts = event.get("client_timestamp", 0)
            time_str = datetime.fromtimestamp(ts / 1000).strftime("%H:%M:%S") if ts > 0 else "unknown"
            desc = self._event_description(et)
            event_descriptions.append(f"{time_str}: {desc}")

        return "; ".join(event_descriptions)

    def _generate_recommendation(self, risk_score: RiskScore) -> str:
        """Generate recommendation for the invigilator."""
        if risk_score.risk_level == RiskLevel.CRITICAL:
            return (
                "IMMEDIATE REVIEW REQUIRED: Strong indicators of academic dishonesty "
                "detected. Review event timeline and consider contacting the student "
                "for a post-exam interview."
            )
        elif risk_score.risk_level == RiskLevel.HIGH:
            return (
                "RECOMMEND REVIEW: Multiple suspicious indicators detected. "
                "Review the event timeline and rule triggers before making a determination."
            )
        elif risk_score.risk_level == RiskLevel.MEDIUM:
            return (
                "MONITOR: Some unusual behavior patterns detected. "
                "Continue monitoring and review if additional indicators appear."
            )
        elif risk_score.risk_level == RiskLevel.LOW:
            return (
                "MINOR CONCERN: Slight deviations from normal behavior. "
                "No immediate action required."
            )
        else:
            return (
                "NO ACTION REQUIRED: Student behavior is within normal parameters. "
                "No integrity concerns detected."
            )

    def _feature_display_name(self, name: str) -> str:
        """Convert feature name to human-readable form."""
        display_names = {
            FeatureName.FOCUS_SWITCH_COUNT.value: "Focus Switches",
            FeatureName.AVG_FOCUS_LOSS_DURATION.value: "Avg Focus Loss Duration",
            FeatureName.AVG_RESPONSE_TIME.value: "Average Response Time",
            FeatureName.TYPING_INTERVAL_MEAN.value: "Typing Speed",
            FeatureName.TYPING_INTERVAL_STD.value: "Typing Rhythm Variability",
            FeatureName.MOUSE_ENTROPY.value: "Mouse Movement Entropy",
            FeatureName.MOUSE_VELOCITY_MEAN.value: "Mouse Speed",
            FeatureName.MOUSE_VELOCITY_STD.value: "Mouse Speed Variability",
            FeatureName.MOUSE_ACCELERATION_MEAN.value: "Mouse Acceleration",
            FeatureName.IDLE_RATIO.value: "Idle Time Ratio",
            FeatureName.QUESTION_SWITCH_FREQUENCY.value: "Question Switching",
            FeatureName.ANSWER_EDIT_COUNT.value: "Answer Edits",
            FeatureName.FULLSCREEN_EXIT_COUNT.value: "Fullscreen Exits",
            FeatureName.DEVTOOL_ATTEMPT_COUNT.value: "DevTools Attempts",
            FeatureName.COPY_COUNT.value: "Copy Operations",
            FeatureName.PASTE_COUNT.value: "Paste Operations",
            FeatureName.NETWORK_DISCONNECT_COUNT.value: "Network Disconnects",
            FeatureName.HEARTBEAT_MISS_RATIO.value: "Missed Heartbeats",
            FeatureName.ANSWER_REVISIT_COUNT.value: "Answer Revisits",
            FeatureName.KEYBOARD_RHYTHM_STD.value: "Keyboard Rhythm",
        }
        return display_names.get(name, name.replace("_", " ").title())

    def _event_description(self, event_type: str) -> str:
        descriptions = {
            EventType.KEY_PASTE.value: "Paste operation detected",
            EventType.KEY_COPY.value: "Copy operation detected",
            EventType.DEVTOOLS_OPEN.value: "Developer tools opened",
            EventType.FULLSCREEN_EXIT.value: "Fullscreen mode exited",
            EventType.WINDOW_BLUR.value: "Window lost focus",
            EventType.WINDOW_FOCUS.value: "Window regained focus",
            EventType.NAVIGATION.value: "Page navigation detected",
            EventType.NETWORK_DISCONNECT.value: "Network disconnected",
            EventType.ALT_TAB.value: "Alt+Tab detected",
        }
        return descriptions.get(event_type, f"Event: {event_type}")


explainer = ExplainableAI()
