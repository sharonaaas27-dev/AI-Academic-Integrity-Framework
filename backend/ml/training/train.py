"""
Model Training Pipeline

Trains and evaluates ML models on synthetic behavior data.
Supports Isolation Forest, Random Forest, and XGBoost.
Evaluates with precision, recall, ROC-AUC, and confusion matrix.
Exports trained models to the model registry.
"""

import logging
import pickle
import json
import sys
from pathlib import Path
from typing import Optional

# Ensure backend directory is on path for imports
_backend_dir = str(Path(__file__).resolve().parents[2])
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

import numpy as np
import pandas as pd
from sklearn.ensemble import (
    IsolationForest,
    RandomForestClassifier,
)
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report,
    roc_curve,
)
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# Feature columns (must match FeatureEngine output)
FEATURE_COLUMNS = [
    "focus_switch_count",
    "avg_focus_loss_duration",
    "mouse_entropy",
    "mouse_velocity_mean",
    "mouse_velocity_std",
    "mouse_acceleration_mean",
    "typing_interval_mean",
    "typing_interval_std",
    "copy_count",
    "paste_count",
    "question_switch_frequency",
    "answer_edit_count",
    "fullscreen_exit_count",
    "devtool_attempt_count",
    "idle_ratio",
    "network_disconnect_count",
    "heartbeat_miss_ratio",
    "answer_revisit_count",
    "keyboard_rhythm_std",
]


class ModelTrainer:
    """
    Trains and evaluates ML models for anomaly detection.
    """

    def __init__(
        self,
        model_dir: str = "ml/models",
        dataset_dir: str = "ml/datasets",
    ):
        self.model_dir = Path(model_dir)
        self.dataset_dir = Path(dataset_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.dataset_dir.mkdir(parents=True, exist_ok=True)
        self.scaler = StandardScaler()

    def load_data(
        self,
        data_path: Optional[str] = None,
    ) -> tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
        """
        Load and split data into train/test sets.

        If no data_path is provided, generates synthetic data.
        """
        if data_path and Path(data_path).exists():
            df = pd.read_csv(data_path)
            logger.info("Loaded dataset from %s: %d samples", data_path, len(df))
        else:
            logger.info("No dataset found, generating synthetic data...")
            from app.services.dataset_generator.generator import DatasetGenerator
            generator = DatasetGenerator()
            df = generator.generate_dataset(
                n_normal=2000,
                n_suspicious=1000,
                n_mixed=300,
            )

        # Drop metadata columns
        X = df[FEATURE_COLUMNS].copy()
        y = df["label"].copy()

        # Handle missing values
        X = X.fillna(X.median())

        # Split
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y,
        )

        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)

        logger.info(
            "Data split: train=%d, test=%d (%.1f%% suspicious)",
            len(X_train), len(X_test), y.mean() * 100,
        )

        return (
            pd.DataFrame(X_train_scaled, columns=FEATURE_COLUMNS),
            pd.DataFrame(X_test_scaled, columns=FEATURE_COLUMNS),
            y_train,
            y_test,
        )

    def train_isolation_forest(
        self,
        X_train: pd.DataFrame,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        contamination: float = 0.1,
    ) -> IsolationForest:
        """Train Isolation Forest model."""
        logger.info("Training Isolation Forest (contamination=%.2f)...", contamination)

        model = IsolationForest(
            contamination=contamination,
            random_state=42,
            n_estimators=200,
            max_samples="auto",
            bootstrap=False,
            n_jobs=-1,
        )
        model.fit(X_train)

        # Evaluate
        y_pred = model.predict(X_test)
        # Convert: -1 = anomaly (suspicious), 1 = normal
        y_pred_binary = np.where(y_pred == -1, 1, 0)

        anomaly_scores = -model.score_samples(X_test)
        auc = roc_auc_score(y_test, anomaly_scores)

        logger.info(
            "Isolation Forest - AUC: %.4f, Precision: %.4f, Recall: %.4f, F1: %.4f",
            auc,
            precision_score(y_test, y_pred_binary),
            recall_score(y_test, y_pred_binary),
            f1_score(y_test, y_pred_binary),
        )

        return model

    def train_random_forest(
        self,
        X_train: pd.DataFrame,
        X_test: pd.DataFrame,
        y_train: pd.Series,
        y_test: pd.Series,
    ) -> RandomForestClassifier:
        """Train Random Forest classifier."""
        logger.info("Training Random Forest...")

        model = RandomForestClassifier(
            n_estimators=200,
            max_depth=15,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight="balanced",
            random_state=42,
            n_jobs=-1,
        )
        model.fit(X_train, y_train)

        # Evaluate
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]
        auc = roc_auc_score(y_test, y_proba)

        logger.info(
            "Random Forest - AUC: %.4f, Precision: %.4f, Recall: %.4f, F1: %.4f",
            auc,
            precision_score(y_test, y_pred),
            recall_score(y_test, y_pred),
            f1_score(y_test, y_pred),
        )

        return model

    def train_xgboost(
        self,
        X_train: pd.DataFrame,
        X_test: pd.DataFrame,
        y_train: pd.Series,
        y_test: pd.Series,
    ) -> "xgboost.XGBClassifier":
        """Train XGBoost classifier."""
        import xgboost as xgb

        logger.info("Training XGBoost...")

        model = xgb.XGBClassifier(
            n_estimators=200,
            max_depth=8,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            scale_pos_weight=(y_train == 0).sum() / (y_train == 1).sum(),
            random_state=42,
            eval_metric="auc",
            use_label_encoder=False,
        )
        model.fit(
            X_train, y_train,
            eval_set=[(X_test, y_test)],
            verbose=False,
        )

        # Evaluate
        y_pred = model.predict(X_test)
        y_proba = model.predict_proba(X_test)[:, 1]
        auc = roc_auc_score(y_test, y_proba)

        logger.info(
            "XGBoost - AUC: %.4f, Precision: %.4f, Recall: %.4f, F1: %.4f",
            auc,
            precision_score(y_test, y_pred),
            recall_score(y_test, y_pred),
            f1_score(y_test, y_pred),
        )

        return model

    def evaluate_all(
        self,
        X_test: pd.DataFrame,
        y_test: pd.Series,
        models: dict[str, object],
    ) -> dict:
        """Evaluate all models and return metrics."""
        results = {}

        for name, model in models.items():
            if name == "isolation_forest":
                y_pred = model.predict(X_test)
                y_pred_binary = np.where(y_pred == -1, 1, 0)
                y_proba = -model.score_samples(X_test)
            else:
                y_pred = model.predict(X_test)
                y_pred_binary = y_pred
                y_proba = model.predict_proba(X_test)[:, 1]

            auc = roc_auc_score(y_test, y_proba)
            precision = precision_score(y_test, y_pred_binary)
            recall = recall_score(y_test, y_pred_binary)
            f1 = f1_score(y_test, y_pred_binary)
            cm = confusion_matrix(y_test, y_pred_binary)

            results[name] = {
                "auc": round(auc, 4),
                "precision": round(precision, 4),
                "recall": round(recall, 4),
                "f1": round(f1, 4),
                "confusion_matrix": cm.tolist(),
                "classification_report": classification_report(
                    y_test, y_pred_binary, output_dict=True,
                ),
            }

            logger.info(
                "%s - AUC: %.4f, Precision: %.4f, Recall: %.4f, F1: %.4f",
                name, auc, precision, recall, f1,
            )

        return results

    def save_model(
        self,
        model: object,
        name: str,
        version: str = "1.0.0",
        metrics: Optional[dict] = None,
    ) -> str:
        """Save model to disk."""
        import xgboost as xgb

        # Save model
        if name == "xgboost":
            model_path = self.model_dir / f"{name}.json"
            model.save_model(str(model_path))
        else:
            model_path = self.model_dir / f"{name}.pkl"
            with open(model_path, "wb") as f:
                pickle.dump(model, f)

        # Save metadata
        metadata = {
            "name": name,
            "version": version,
            "type": name,
            "path": str(model_path),
            "metrics": metrics or {},
            "feature_columns": FEATURE_COLUMNS,
        }
        metadata_path = self.model_dir / f"{name}_metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        # Save scaler
        scaler_path = self.model_dir / f"{name}_scaler.pkl"
        with open(scaler_path, "wb") as f:
            pickle.dump(self.scaler, f)

        logger.info("Model saved: %s v%s -> %s", name, version, model_path)
        return str(model_path)

    def run_training_pipeline(
        self,
        data_path: Optional[str] = None,
        save_models: bool = True,
    ) -> dict:
        """
        Run the complete training pipeline.

        Returns:
            Dictionary with training results and metrics
        """
        logger.info("=" * 60)
        logger.info("Starting model training pipeline")
        logger.info("=" * 60)

        # Load data
        X_train, X_test, y_train, y_test = self.load_data(data_path)

        # Train models
        models = {}

        isolation_forest = self.train_isolation_forest(X_train, X_test, y_test)
        models["isolation_forest"] = isolation_forest

        random_forest = self.train_random_forest(X_train, X_test, y_train, y_test)
        models["random_forest"] = random_forest

        xgboost = self.train_xgboost(X_train, X_test, y_train, y_test)
        models["xgboost"] = xgboost

        # Evaluate
        results = self.evaluate_all(X_test, y_test, models)

        # Save models
        if save_models:
            for name, model in models.items():
                self.save_model(model, name, metrics=results.get(name))

            # Save overall training report
            report = {
                "training_date": str(pd.Timestamp.now()),
                "dataset_size": len(X_train) + len(X_test),
                "feature_count": len(FEATURE_COLUMNS),
                "results": results,
            }
            report_path = self.model_dir / "training_report.json"
            with open(report_path, "w") as f:
                json.dump(report, f, indent=2)

            logger.info("Training report saved to %s", report_path)

        logger.info("=" * 60)
        logger.info("Training pipeline complete")
        logger.info("=" * 60)

        return {
            "models": list(models.keys()),
            "results": results,
        }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    trainer = ModelTrainer()
    trainer.run_training_pipeline()
