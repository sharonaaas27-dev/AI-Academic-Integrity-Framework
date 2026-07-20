"""
Timeline Engine

Creates a chronological timeline of behavior events for a student's exam session.
Timeline entries include:
  - Timestamp
  - Event type (human-readable)
  - Event data
  - Severity (info, warning, critical)
  - Duration (for focus events)

Used for visual timeline display in the dashboard.
"""

import logging
from typing import Optional
from datetime import datetime

from ...domain.enums import EventType
from ...models.sqlalchemy.behavior import RawBehaviorEvent

logger = logging.getLogger(__name__)


class TimelineEngine:
    """
    Generates a human-readable event timeline from raw behavior events.
    """

    def build_timeline(
        self,
        events: list[dict],
        start_time: Optional[float] = None,
    ) -> list[dict]:
        """
        Build a timeline from raw events sorted chronologically.

        Args:
            events: List of raw behavior event dicts
            start_time: Exam start timestamp for relative timing

        Returns:
            List of timeline entries
        """
        if not events:
            return []

        sorted_events = sorted(
            events,
            key=lambda e: e.get("client_timestamp", 0),
        )

        timeline = []
        last_focus_blur_time = None

        for event in sorted_events:
            event_type = event.get("event_type", "")
            client_ts = event.get("client_timestamp", 0)
            data = event.get("event_data", {}) or event.get("data", {})

            # Skip frequent events to avoid timeline clutter
            if event_type in (
                EventType.MOUSE_MOVE.value,
                EventType.KEY_DOWN.value,
                EventType.HEARTBEAT.value,
            ):
                continue

            entry = self._create_entry(event_type, client_ts, data, start_time)
            if entry:
                timeline.append(entry)

        return timeline

    def build_summary(self, timeline: list[dict]) -> dict:
        """Generate a summary of the timeline."""
        if not timeline:
            return {
                "total_events": 0,
                "suspicious_events": 0,
                "info_events": 0,
                "warning_events": 0,
                "critical_events": 0,
                "first_event": None,
                "last_event": None,
            }

        severity_counts = {"info": 0, "warning": 0, "critical": 0}
        suspicious_types = {
            EventType.KEY_PASTE.value,
            EventType.KEY_COPY.value,
            EventType.DEVTOOLS_OPEN.value,
            EventType.FULLSCREEN_EXIT.value,
            EventType.NAVIGATION.value,
        }

        for entry in timeline:
            severity = entry.get("severity", "info")
            if severity in severity_counts:
                severity_counts[severity] += 1

        suspicious_count = sum(
            1
            for e in timeline
            if e.get("event_type") in suspicious_types
        )

        return {
            "total_events": len(timeline),
            "suspicious_events": suspicious_count,
            **severity_counts,
            "first_event": timeline[0] if timeline else None,
            "last_event": timeline[-1] if timeline else None,
        }

    def _create_entry(
        self,
        event_type: str,
        timestamp: float,
        data: dict,
        start_time: Optional[float],
    ) -> Optional[dict]:
        """Create a timeline entry with human-readable description."""
        entry = {
            "event_type": event_type,
            "timestamp": timestamp,
            "timestamp_iso": datetime.fromtimestamp(timestamp / 1000).isoformat()
            if timestamp > 0
            else None,
            "relative_time": self._format_relative_time(timestamp, start_time),
            "severity": "info",
            "description": "",
            "details": data,
        }

        if event_type == EventType.WINDOW_BLUR.value:
            entry["description"] = "Window lost focus"
            entry["severity"] = "warning"
            entry["icon"] = "eye-off"

        elif event_type == EventType.WINDOW_FOCUS.value:
            entry["description"] = "Window regained focus"
            entry["severity"] = "info"
            entry["icon"] = "eye"

        elif event_type == EventType.KEY_COPY.value:
            entry["description"] = "Copy operation detected"
            entry["severity"] = "warning"
            entry["icon"] = "copy"

        elif event_type == EventType.KEY_PASTE.value:
            entry["description"] = "Paste operation detected"
            entry["severity"] = "critical"
            entry["icon"] = "clipboard-paste"

        elif event_type == EventType.FULLSCREEN_EXIT.value:
            entry["description"] = "Exited fullscreen mode"
            entry["severity"] = "warning"
            entry["icon"] = "minimize-2"

        elif event_type == EventType.DEVTOOLS_OPEN.value:
            method = data.get("method", "unknown")
            entry["description"] = f"Developer tools opened ({method})"
            entry["severity"] = "critical"
            entry["icon"] = "terminal"

        elif event_type == EventType.NAVIGATION.value:
            entry["description"] = "Page navigation detected"
            entry["severity"] = "warning"
            entry["icon"] = "external-link"

        elif event_type == EventType.NETWORK_DISCONNECT.value:
            entry["description"] = "Network disconnected"
            entry["severity"] = "warning"
            entry["icon"] = "wifi-off"

        elif event_type == EventType.NETWORK_RECONNECT.value:
            entry["description"] = "Network reconnected"
            entry["severity"] = "info"
            entry["icon"] = "wifi"

        elif event_type == EventType.TAB_HIDDEN.value:
            entry["description"] = "Tab hidden (switched away)"
            entry["severity"] = "warning"
            entry["icon"] = "tab"

        elif event_type == EventType.TAB_VISIBILITY.value:
            entry["description"] = "Returned to tab"
            entry["severity"] = "info"
            entry["icon"] = "tab"

        elif event_type == EventType.ALT_TAB.value:
            entry["description"] = "Alt+Tab detected"
            entry["severity"] = "warning"
            entry["icon"] = "command"

        elif event_type == EventType.BROWSER_RESIZE.value:
            entry["description"] = "Browser window resized"
            entry["severity"] = "info"
            entry["icon"] = "maximize-2"

        elif event_type == EventType.REFRESH.value:
            entry["description"] = "Page refresh detected"
            entry["severity"] = "critical"
            entry["icon"] = "refresh-cw"

        elif event_type == EventType.EXAM_START.value:
            entry["description"] = "Exam started"
            entry["severity"] = "info"
            entry["icon"] = "play"

        elif event_type == EventType.EXAM_SUBMIT.value:
            entry["description"] = "Exam submitted"
            entry["severity"] = "info"
            entry["icon"] = "check-circle"

        elif event_type == EventType.QUESTION_NAVIGATE.value:
            action = data.get("action", "navigate")
            entry["description"] = f"Question {action}"
            entry["severity"] = "info"
            entry["icon"] = "arrow-right"

        elif event_type == EventType.ANSWER_CHANGE.value:
            entry["description"] = "Answer modified"
            entry["severity"] = "info"
            entry["icon"] = "edit"

        elif event_type == EventType.MOUSE_IDLE.value:
            entry["description"] = "Mouse idle detected"
            entry["severity"] = "info"
            entry["icon"] = "mouse-pointer"

        else:
            return None  # Skip unknown events

        return entry

    def _format_relative_time(
        self,
        timestamp: float,
        start_time: Optional[float],
    ) -> str:
        """Format relative time from exam start."""
        if not start_time or timestamp <= 0:
            return ""

        diff_seconds = (timestamp - start_time) / 1000
        if diff_seconds < 0:
            return "before exam"

        minutes = int(diff_seconds // 60)
        seconds = int(diff_seconds % 60)
        return f"+{minutes:02d}:{seconds:02d}"


timeline_engine = TimelineEngine()
