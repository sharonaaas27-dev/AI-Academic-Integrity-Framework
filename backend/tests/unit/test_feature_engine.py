"""Tests for the feature engineering engine."""

import pytest
from app.services.feature_engineering.feature_engine import FeatureEngine
from app.domain.enums import FeatureName, EventType


class TestFeatureEngine:
    @pytest.fixture
    def engine(self):
        return FeatureEngine()

    def test_empty_events(self, engine):
        features = engine.extract_features([])
        assert all(v == 0.0 for v in features.values())

    def test_focus_switch_count(self, engine):
        events = [
            {"event_type": EventType.WINDOW_BLUR.value, "event_data": {}, "client_timestamp": 1000},
            {"event_type": EventType.WINDOW_FOCUS.value, "event_data": {}, "client_timestamp": 2000},
            {"event_type": EventType.WINDOW_BLUR.value, "event_data": {}, "client_timestamp": 3000},
        ]
        features = engine.extract_features(events)
        assert features[FeatureName.FOCUS_SWITCH_COUNT.value] == 2.0

    def test_paste_and_copy_count(self, engine):
        events = [
            {"event_type": EventType.KEY_PASTE.value, "event_data": {}, "client_timestamp": 1000},
            {"event_type": EventType.KEY_PASTE.value, "event_data": {}, "client_timestamp": 2000},
            {"event_type": EventType.KEY_COPY.value, "event_data": {}, "client_timestamp": 3000},
        ]
        features = engine.extract_features(events)
        assert features[FeatureName.PASTE_COUNT.value] == 2.0
        assert features[FeatureName.COPY_COUNT.value] == 1.0

    def test_devtool_detection(self, engine):
        events = [
            {"event_type": EventType.DEVTOOLS_OPEN.value, "event_data": {"method": "shortcut"}, "client_timestamp": 1000},
        ]
        features = engine.extract_features(events)
        assert features[FeatureName.DEVTOOL_ATTEMPT_COUNT.value] == 1.0

    def test_fullscreen_exits(self, engine):
        events = [
            {"event_type": EventType.FULLSCREEN_EXIT.value, "event_data": {}, "client_timestamp": 1000},
            {"event_type": EventType.FULLSCREEN_EXIT.value, "event_data": {}, "client_timestamp": 2000},
            {"event_type": EventType.FULLSCREEN_EXIT.value, "event_data": {}, "client_timestamp": 3000},
        ]
        features = engine.extract_features(events)
        assert features[FeatureName.FULLSCREEN_EXIT_COUNT.value] == 3.0

    def test_question_navigation(self, engine):
        events = [
            {"event_type": EventType.QUESTION_NAVIGATE.value, "event_data": {"action": "next"}, "client_timestamp": 1000},
            {"event_type": EventType.QUESTION_NAVIGATE.value, "event_data": {"action": "prev"}, "client_timestamp": 2000},
        ]
        features = engine.extract_features(events)
        assert features[FeatureName.QUESTION_SWITCH_FREQUENCY.value] == 2.0
