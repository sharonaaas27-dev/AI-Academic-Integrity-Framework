"""
AI Dataset Generator

Generates synthetic behavioral data for:
  - Normal students (typical exam behavior)
  - Suspicious students (cheating patterns)
  - Edge cases (noise, missing data)

Exports CSV files for model training.
"""

import csv
import random
import math
import logging
from pathlib import Path
from typing import Generator
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from ...domain.enums import FeatureName

logger = logging.getLogger(__name__)

# Feature column names (must match FeatureEngine output)
FEATURE_COLUMNS = [
    FeatureName.FOCUS_SWITCH_COUNT.value,
    FeatureName.AVG_FOCUS_LOSS_DURATION.value,
    FeatureName.MOUSE_ENTROPY.value,
    FeatureName.MOUSE_VELOCITY_MEAN.value,
    FeatureName.MOUSE_VELOCITY_STD.value,
    FeatureName.MOUSE_ACCELERATION_MEAN.value,
    FeatureName.TYPING_INTERVAL_MEAN.value,
    FeatureName.TYPING_INTERVAL_STD.value,
    FeatureName.COPY_COUNT.value,
    FeatureName.PASTE_COUNT.value,
    FeatureName.QUESTION_SWITCH_FREQUENCY.value,
    FeatureName.ANSWER_EDIT_COUNT.value,
    FeatureName.FULLSCREEN_EXIT_COUNT.value,
    FeatureName.DEVTOOL_ATTEMPT_COUNT.value,
    FeatureName.IDLE_RATIO.value,
    FeatureName.NETWORK_DISCONNECT_COUNT.value,
    FeatureName.HEARTBEAT_MISS_RATIO.value,
    FeatureName.ANSWER_REVISIT_COUNT.value,
    FeatureName.KEYBOARD_RHYTHM_STD.value,
]


@dataclass
class StudentBehaviorProfile:
    """Defines the behavioral profile for a synthetic student."""

    label: int  # 0 = normal, 1 = suspicious
    focus_switch_range: tuple[float, float] = (0, 3)
    focus_loss_duration_range: tuple[float, float] = (0, 5)
    mouse_entropy_range: tuple[float, float] = (3.0, 6.0)
    mouse_velocity_range: tuple[float, float] = (0.5, 3.0)
    mouse_velocity_std_range: tuple[float, float] = (0.1, 1.0)
    mouse_acceleration_range: tuple[float, float] = (0.1, 1.5)
    typing_interval_range: tuple[float, float] = (200, 800)
    typing_interval_std_range: tuple[float, float] = (50, 200)
    copy_count_range: tuple[float, float] = (0, 0)
    paste_count_range: tuple[float, float] = (0, 0)
    question_switch_range: tuple[float, float] = (0, 5)
    answer_edit_range: tuple[float, float] = (0, 2)
    fullscreen_exit_range: tuple[float, float] = (0, 1)
    devtool_range: tuple[float, float] = (0, 0)
    idle_ratio_range: tuple[float, float] = (0, 0.1)
    network_disconnect_range: tuple[float, float] = (0, 1)
    heartbeat_miss_range: tuple[float, float] = (0, 0.05)
    answer_revisit_range: tuple[float, float] = (0, 2)
    keyboard_rhythm_std_range: tuple[float, float] = (50, 150)


class DatasetGenerator:
    """
    Generates synthetic behavior datasets for ML model training.
    """

    def __init__(self, random_seed: int = 42):
        self.rng = np.random.default_rng(random_seed)
        random.seed(random_seed)

    def generate_student(
        self,
        profile: StudentBehaviorProfile,
        student_id: int,
        exam_id: int = 1,
    ) -> dict:
        """Generate a single student's feature vector from a profile."""
        features = {
            FeatureName.FOCUS_SWITCH_COUNT.value: self._randint_range(*profile.focus_switch_range),
            FeatureName.AVG_FOCUS_LOSS_DURATION.value: round(self._randfloat_range(*profile.focus_loss_duration_range), 2),
            FeatureName.MOUSE_ENTROPY.value: round(self._randfloat_range(*profile.mouse_entropy_range), 4),
            FeatureName.MOUSE_VELOCITY_MEAN.value: round(self._randfloat_range(*profile.mouse_velocity_range), 4),
            FeatureName.MOUSE_VELOCITY_STD.value: round(self._randfloat_range(*profile.mouse_velocity_std_range), 4),
            FeatureName.MOUSE_ACCELERATION_MEAN.value: round(self._randfloat_range(*profile.mouse_acceleration_range), 4),
            FeatureName.TYPING_INTERVAL_MEAN.value: round(self._randfloat_range(*profile.typing_interval_range), 2),
            FeatureName.TYPING_INTERVAL_STD.value: round(self._randfloat_range(*profile.typing_interval_std_range), 2),
            FeatureName.COPY_COUNT.value: self._randint_range(*profile.copy_count_range),
            FeatureName.PASTE_COUNT.value: self._randint_range(*profile.paste_count_range),
            FeatureName.QUESTION_SWITCH_FREQUENCY.value: self._randint_range(*profile.question_switch_range),
            FeatureName.ANSWER_EDIT_COUNT.value: self._randint_range(*profile.answer_edit_range),
            FeatureName.FULLSCREEN_EXIT_COUNT.value: self._randint_range(*profile.fullscreen_exit_range),
            FeatureName.DEVTOOL_ATTEMPT_COUNT.value: self._randint_range(*profile.devtool_range),
            FeatureName.IDLE_RATIO.value: round(self._randfloat_range(*profile.idle_ratio_range), 4),
            FeatureName.NETWORK_DISCONNECT_COUNT.value: self._randint_range(*profile.network_disconnect_range),
            FeatureName.HEARTBEAT_MISS_RATIO.value: round(self._randfloat_range(*profile.heartbeat_miss_range), 4),
            FeatureName.ANSWER_REVISIT_COUNT.value: self._randint_range(*profile.answer_revisit_range),
            FeatureName.KEYBOARD_RHYTHM_STD.value: round(self._randfloat_range(*profile.keyboard_rhythm_std_range), 2),
        }

        # Add noise
        features = self._add_noise(features, noise_level=0.05)

        return {
            "student_id": student_id,
            "exam_id": exam_id,
            **features,
            "label": profile.label,
        }

    def generate_normal_profile(self) -> StudentBehaviorProfile:
        """Profile for a typical honest student."""
        return StudentBehaviorProfile(label=0)

    def generate_suspicious_profile(self) -> StudentBehaviorProfile:
        """Profile for a student exhibiting cheating patterns."""
        return StudentBehaviorProfile(
            label=1,
            focus_switch_range=(6, 20),
            focus_loss_duration_range=(10, 120),
            mouse_entropy_range=(0.5, 2.5),
            mouse_velocity_range=(0.1, 1.0),
            mouse_velocity_std_range=(0.02, 0.3),
            mouse_acceleration_range=(0.02, 0.3),
            typing_interval_range=(500, 3000),
            typing_interval_std_range=(200, 800),
            copy_count_range=(0, 5),
            paste_count_range=(0, 5),
            question_switch_range=(8, 30),
            answer_edit_range=(3, 15),
            fullscreen_exit_range=(2, 10),
            devtool_range=(0, 5),
            idle_ratio_range=(0.15, 0.6),
            network_disconnect_range=(1, 8),
            heartbeat_miss_range=(0.05, 0.4),
            answer_revisit_range=(3, 15),
            keyboard_rhythm_std_range=(200, 600),
        )

    def generate_mixed_profile(self) -> StudentBehaviorProfile:
        """
        Profile for a student with some suspicious signals.
        Useful for generating borderline cases.
        """
        return StudentBehaviorProfile(
            label=1,
            focus_switch_range=(4, 10),
            focus_loss_duration_range=(5, 30),
            mouse_entropy_range=(2.0, 4.0),
            mouse_velocity_range=(0.3, 1.5),
            mouse_velocity_std_range=(0.05, 0.5),
            mouse_acceleration_range=(0.05, 0.8),
            typing_interval_range=(300, 1500),
            typing_interval_std_range=(100, 400),
            copy_count_range=(0, 2),
            paste_count_range=(0, 2),
            question_switch_range=(5, 15),
            answer_edit_range=(2, 8),
            fullscreen_exit_range=(1, 5),
            devtool_range=(0, 2),
            idle_ratio_range=(0.05, 0.3),
            network_disconnect_range=(0, 4),
            heartbeat_miss_range=(0.02, 0.15),
            answer_revisit_range=(1, 8),
            keyboard_rhythm_std_range=(100, 300),
        )

    def generate_dataset(
        self,
        n_normal: int = 1000,
        n_suspicious: int = 500,
        n_mixed: int = 200,
        noise_percent: float = 0.1,
        missing_percent: float = 0.05,
    ) -> pd.DataFrame:
        """
        Generate a complete synthetic dataset.

        Args:
            n_normal: Number of normal student samples
            n_suspicious: Number of suspicious student samples
            n_mixed: Number of borderline suspicious samples
            noise_percent: Proportion of noise to add to features
            missing_percent: Proportion of missing values to introduce

        Returns:
            DataFrame with features and labels
        """
        records = []
        student_id = 1

        # Generate normal students
        normal_profile = self.generate_normal_profile()
        for _ in range(n_normal):
            records.append(
                self.generate_student(normal_profile, student_id)
            )
            student_id += 1

        # Generate suspicious students
        suspicious_profile = self.generate_suspicious_profile()
        for _ in range(n_suspicious):
            records.append(
                self.generate_student(suspicious_profile, student_id)
            )
            student_id += 1

        # Generate mixed/borderline students
        mixed_profile = self.generate_mixed_profile()
        for _ in range(n_mixed):
            records.append(
                self.generate_student(mixed_profile, student_id)
            )
            student_id += 1

        df = pd.DataFrame(records)

        # Add noise
        if noise_percent > 0:
            df = self._add_dataset_noise(df, noise_percent)

        # Add missing values
        if missing_percent > 0:
            df = self._add_missing_values(df, missing_percent)

        # Shuffle
        df = df.sample(frac=1, random_state=42).reset_index(drop=True)

        logger.info(
            "Generated dataset: %d samples (%d normal, %d suspicious, %d mixed)",
            len(df), n_normal, n_suspicious, n_mixed,
        )

        return df

    def export_csv(
        self,
        df: pd.DataFrame,
        output_path: str = "ml/datasets/synthetic_behavior.csv",
    ) -> str:
        """Export dataset to CSV."""
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(path, index=False)
        logger.info("Dataset exported to %s", path)
        return str(path)

    def export_for_training(
        self,
        n_normal: int = 2000,
        n_suspicious: int = 1000,
        n_mixed: int = 300,
        output_dir: str = "ml/datasets",
    ) -> dict[str, str]:
        """
        Generate and export train/test/validation splits.
        """
        df = self.generate_dataset(n_normal, n_suspicious, n_mixed)

        # Split
        train = df.sample(frac=0.7, random_state=42)
        remaining = df.drop(train.index)
        val = remaining.sample(frac=0.5, random_state=42)
        test = remaining.drop(val.index)

        output_dir_path = Path(output_dir)
        output_dir_path.mkdir(parents=True, exist_ok=True)

        paths = {
            "train": str(output_dir_path / "train.csv"),
            "val": str(output_dir_path / "val.csv"),
            "test": str(output_dir_path / "test.csv"),
            "full": str(output_dir_path / "full.csv"),
        }

        train.to_csv(paths["train"], index=False)
        val.to_csv(paths["val"], index=False)
        test.to_csv(paths["test"], index=False)
        df.to_csv(paths["full"], index=False)

        logger.info(
            "Training dataset exported: train=%d val=%d test=%d",
            len(train), len(val), len(test),
        )

        return paths

    def _randint_range(self, low: float, high: float) -> int:
        return int(round(self.rng.uniform(low, high)))

    def _randfloat_range(self, low: float, high: float) -> float:
        return self.rng.uniform(low, high)

    def _add_noise(
        self,
        features: dict,
        noise_level: float = 0.05,
    ) -> dict:
        """Add Gaussian noise to features."""
        noisy = {}
        for key, value in features.items():
            if isinstance(value, (int, float)) and value != 0:
                noise = self.rng.normal(0, abs(value) * noise_level)
                noisy[key] = max(0, value + noise)
            else:
                noisy[key] = value
        return noisy

    def _add_dataset_noise(self, df: pd.DataFrame, noise_percent: float) -> pd.DataFrame:
        """Add noise to the entire dataset."""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        numeric_cols = [c for c in numeric_cols if c not in ("student_id", "exam_id", "label")]

        for col in numeric_cols:
            noise = self.rng.normal(0, df[col].std() * noise_percent, len(df))
            df[col] = (df[col] + noise).clip(lower=0)

        return df

    def _add_missing_values(self, df: pd.DataFrame, missing_percent: float) -> pd.DataFrame:
        """Introduce missing values."""
        numeric_cols = df.select_dtypes(include=[np.number]).columns
        numeric_cols = [c for c in numeric_cols if c not in ("student_id", "exam_id", "label")]

        for col in numeric_cols:
            mask = self.rng.random(len(df)) < missing_percent
            df.loc[mask, col] = np.nan

        return df


dataset_generator = DatasetGenerator()
