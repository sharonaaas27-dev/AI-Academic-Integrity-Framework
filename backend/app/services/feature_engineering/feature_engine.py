"""
Feature Engineering Engine

Converts raw behavior events into engineered features for ML and rule evaluation.
Operates in sliding time windows.

Features generated:
  - focus_switch_count: Number of window blur/focus switches
  - avg_focus_loss_duration: Average duration of focus loss events
  - avg_response_time: Average time between question display and answer
  - typing_interval_mean/std: Statistics of time between key presses
  - mouse_entropy: Shannon entropy of mouse positions
  - mouse_velocity_mean/std: Statistics of mouse movement speed
  - mouse_acceleration_mean: Average mouse acceleration
  - idle_ratio: Proportion of time with no activity
  - question_switch_frequency: Rate of question navigation
  - answer_edit_count: Number of answer modifications
  - fullscreen_exit_count: Number of fullscreen exits
  - devtool_attempt_count: Number of devtools detection events
  - copy_count: Number of copy events
  - paste_count: Number of paste events
  - network_disconnect_count: Number of network disconnections
  - heartbeat_miss_ratio: Proportion of missed heartbeats
  - answer_revisit_count: Number of times answers were revisited
  - keyboard_rhythm_std: Standard deviation of key press intervals
"""

import logging
import math
from collections import defaultdict
from typing import Optional
from uuid import UUID
from datetime import datetime

from ...core.config import settings
from ...domain.enums import EventType, FeatureName
from ...models.sqlalchemy.behavior import RawBehaviorEvent

logger = logging.getLogger(__name__)


class FeatureEngine:
    """
    Processes raw behavior events into engineered features.
    """

    def __init__(self):
        self.window_seconds = settings.FEATURE_WINDOW_SECONDS
        self.idle_threshold = settings.FEATURE_IDLE_THRESHOLD_SECONDS

    def extract_features(
        self,
        events: list[dict],
        exam_duration_seconds: Optional[float] = None,
    ) -> dict[str, float]:
        """
        Extract features from a list of raw behavior events.

        Args:
            events: List of raw behavior event dicts
            exam_duration_seconds: Total exam duration (for ratio calculations)

        Returns:
            Dictionary of feature name -> value
        """
        if not events:
            return self._empty_features()

        # Categorize events
        focus_events = []
        mouse_events = []
        keyboard_events = []
        clipboard_events = []
        navigation_events = []
        fullscreen_events = []
        devtools_events = []
        network_events = []
        heartbeat_events = []
        idle_events = []
        answer_events = []

        for event in events:
            event_type = event.get("event_type", "")
            data = event.get("event_data", {}) or event.get("data", {})
            timestamp = event.get("client_timestamp", 0)

            if event_type in (
                EventType.WINDOW_BLUR.value,
                EventType.WINDOW_FOCUS.value,
                EventType.TAB_VISIBILITY.value,
                EventType.TAB_HIDDEN.value,
                EventType.ALT_TAB.value,
            ):
                focus_events.append(event)
            elif event_type == EventType.MOUSE_MOVE.value:
                mouse_events.append(event)
            elif event_type == EventType.KEY_DOWN.value:
                keyboard_events.append(event)
            elif event_type in (EventType.KEY_COPY.value, EventType.KEY_PASTE.value):
                clipboard_events.append(event)
            elif event_type == EventType.QUESTION_NAVIGATE.value:
                navigation_events.append(event)
            elif event_type == EventType.FULLSCREEN_EXIT.value:
                fullscreen_events.append(event)
            elif event_type == EventType.DEVTOOLS_OPEN.value:
                devtools_events.append(event)
            elif event_type in (EventType.NETWORK_DISCONNECT.value, EventType.NETWORK_RECONNECT.value):
                network_events.append(event)
            elif event_type == EventType.HEARTBEAT.value:
                heartbeat_events.append(event)
            elif event_type == EventType.MOUSE_IDLE.value:
                idle_events.append(event)
            elif event_type == EventType.ANSWER_CHANGE.value:
                answer_events.append(event)

        features = {}

        # Focus features
        features[FeatureName.FOCUS_SWITCH_COUNT.value] = self._count_focus_switches(
            focus_events
        )
        features[FeatureName.AVG_FOCUS_LOSS_DURATION.value] = self._avg_focus_loss_duration(
            focus_events
        )

        # Mouse features
        features[FeatureName.MOUSE_ENTROPY.value] = self._mouse_entropy(mouse_events)
        features[FeatureName.MOUSE_VELOCITY_MEAN.value] = self._mouse_velocity_stats(
            mouse_events
        )[0]
        features[FeatureName.MOUSE_VELOCITY_STD.value] = self._mouse_velocity_stats(
            mouse_events
        )[1]
        features[FeatureName.MOUSE_ACCELERATION_MEAN.value] = self._mouse_acceleration(
            mouse_events
        )

        # Keyboard features
        typing_stats = self._typing_intervals(keyboard_events)
        features[FeatureName.TYPING_INTERVAL_MEAN.value] = typing_stats[0]
        features[FeatureName.TYPING_INTERVAL_STD.value] = typing_stats[1]
        features[FeatureName.KEYBOARD_RHYTHM_STD.value] = typing_stats[1]

        # Clipboard features
        features[FeatureName.COPY_COUNT.value] = self._count_type(
            clipboard_events, EventType.KEY_COPY.value
        )
        features[FeatureName.PASTE_COUNT.value] = self._count_type(
            clipboard_events, EventType.KEY_PASTE.value
        )

        # Navigation features
        features[FeatureName.QUESTION_SWITCH_FREQUENCY.value] = len(navigation_events)

        # Answer features
        features[FeatureName.ANSWER_EDIT_COUNT.value] = len(answer_events)
        features[FeatureName.ANSWER_REVISIT_COUNT.value] = self._count_answer_revisits(
            answer_events
        )

        # Fullscreen features
        features[FeatureName.FULLSCREEN_EXIT_COUNT.value] = len(fullscreen_events)

        # DevTools features
        features[FeatureName.DEVTOOL_ATTEMPT_COUNT.value] = len(devtools_events)

        # Network features
        features[FeatureName.NETWORK_DISCONNECT_COUNT.value] = self._count_type(
            network_events, EventType.NETWORK_DISCONNECT.value
        )

        # Idle / heartbeat features
        features[FeatureName.IDLE_RATIO.value] = self._idle_ratio(
            idle_events, events, exam_duration_seconds
        )
        features[FeatureName.HEARTBEAT_MISS_RATIO.value] = self._heartbeat_miss_ratio(
            heartbeat_events, exam_duration_seconds
        )

        return features

    def _empty_features(self) -> dict[str, float]:
        return {feat.value: 0.0 for feat in FeatureName}

    def _count_focus_switches(self, events: list[dict]) -> float:
        focus_types = {
            EventType.WINDOW_BLUR.value,
            EventType.TAB_VISIBILITY.value,
            EventType.TAB_HIDDEN.value,
            EventType.ALT_TAB.value,
        }
        return float(len([e for e in events if e.get("event_type") in focus_types]))

    def _avg_focus_loss_duration(self, events: list[dict]) -> float:
        blurs = sorted(
            [e for e in events if e.get("event_type") == EventType.WINDOW_BLUR.value],
            key=lambda e: e.get("client_timestamp", 0),
        )
        focuses = sorted(
            [e for e in events if e.get("event_type") == EventType.WINDOW_FOCUS.value],
            key=lambda e: e.get("client_timestamp", 0),
        )

        if not blurs:
            return 0.0

        durations = []
        for blur in blurs:
            blur_time = blur.get("client_timestamp", 0)
            # Find next focus event
            next_focus = next(
                (f for f in focuses if f.get("client_timestamp", 0) > blur_time),
                None,
            )
            if next_focus:
                duration = next_focus.get("client_timestamp", 0) - blur_time
                durations.append(duration)

        return float(sum(durations) / len(durations)) if durations else 0.0

    def _mouse_entropy(self, events: list[dict]) -> float:
        """Calculate Shannon entropy of mouse positions."""
        if not events:
            return 0.0

        # Discretize positions into 50px grid cells
        cells = defaultdict(int)
        total = 0

        for event in events:
            data = event.get("event_data", {}) or event.get("data", {})
            x = data.get("x", 0)
            y = data.get("y", 0)
            cell = (int(x / 50), int(y / 50))
            cells[cell] += 1
            total += 1

        if total == 0:
            return 0.0

        entropy = 0.0
        for count in cells.values():
            p = count / total
            if p > 0:
                entropy -= p * math.log2(p)

        return round(entropy, 4)

    def _mouse_velocity_stats(self, events: list[dict]) -> tuple[float, float]:
        """Calculate mean and std of mouse velocity."""
        velocities = []
        for event in events:
            data = event.get("event_data", {}) or event.get("data", {})
            velocity = data.get("velocity", None)
            if velocity is not None and velocity > 0:
                velocities.append(velocity)

        if not velocities:
            return 0.0, 0.0

        mean = sum(velocities) / len(velocities)
        variance = sum((v - mean) ** 2 for v in velocities) / len(velocities)
        return round(mean, 4), round(math.sqrt(variance), 4)

    def _mouse_acceleration(self, events: list[dict]) -> float:
        """Calculate average mouse acceleration."""
        velocities = []
        for event in events:
            data = event.get("event_data", {}) or event.get("data", {})
            velocity = data.get("velocity", None)
            if velocity is not None:
                velocities.append(velocity)

        if len(velocities) < 2:
            return 0.0

        accelerations = []
        for i in range(1, len(velocities)):
            accelerations.append(abs(velocities[i] - velocities[i - 1]))

        return round(sum(accelerations) / len(accelerations), 4) if accelerations else 0.0

    def _typing_intervals(self, events: list[dict]) -> tuple[float, float]:
        """Calculate mean and std of intervals between key presses."""
        intervals = []
        last_time = None

        for event in events:
            data = event.get("event_data", {}) or event.get("data", {})
            interval = data.get("interval", None)
            if interval is not None and interval > 0 and interval < 10000:  # Sanity check
                intervals.append(interval)

        if not intervals:
            return 0.0, 0.0

        mean = sum(intervals) / len(intervals)
        variance = sum((i - mean) ** 2 for i in intervals) / len(intervals)
        return round(mean, 2), round(math.sqrt(variance), 2)

    def _count_type(self, events: list[dict], event_type: str) -> float:
        return float(len([e for e in events if e.get("event_type") == event_type]))

    def _count_answer_revisits(self, events: list[dict]) -> float:
        """Count revisits to previously answered questions."""
        question_ids = set()
        revisits = 0
        for event in events:
            data = event.get("event_data", {}) or event.get("data", {})
            qid = data.get("questionId")
            if qid in question_ids:
                revisits += 1
            question_ids.add(qid)
        return float(revisits)

    def _idle_ratio(
        self,
        idle_events: list[dict],
        all_events: list[dict],
        exam_duration: Optional[float],
    ) -> float:
        """Calculate ratio of idle time to total time."""
        if not idle_events:
            return 0.0

        total_idle_time = sum(
            e.get("event_data", {}).get("duration", 0) or e.get("data", {}).get("duration", 0)
            for e in idle_events
        )

        if exam_duration and exam_duration > 0:
            return min(total_idle_time / (exam_duration * 1000), 1.0)

        # If no exam duration, estimate from event timestamps
        if len(all_events) >= 2:
            first_ts = all_events[0].get("client_timestamp", 0)
            last_ts = all_events[-1].get("client_timestamp", 0)
            total_time = last_ts - first_ts
            if total_time > 0:
                return min(total_idle_time / total_time, 1.0)

        return 0.0

    def _heartbeat_miss_ratio(
        self,
        heartbeat_events: list[dict],
        exam_duration: Optional[float],
    ) -> float:
        """Calculate ratio of missed heartbeats."""
        if not exam_duration or exam_duration <= 0:
            return 0.0

        expected_heartbeats = exam_duration / (settings.WS_HEARTBEAT_INTERVAL)
        actual_heartbeats = len(heartbeat_events)

        if expected_heartbeats <= 0:
            return 0.0

        missed = max(0, expected_heartbeats - actual_heartbeats)
        return round(missed / expected_heartbeats, 4)


feature_engine = FeatureEngine()
