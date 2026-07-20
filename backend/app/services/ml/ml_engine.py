"""
Machine Learning Engine

Provides an abstraction layer for ML model inference.
Supports Isolation Forest, Random Forest, and XGBoost.
Easy to plug new models via the BaseModel interface.
Versioned models with ONNX export support.
"""

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Any
import pickle
import json
from pathlib import Path

try:
    import numpy as np
    import pandas as pd
    HAS_NUMPY = True
except ImportError:
    np = None
    pd = None
    HAS_NUMPY = False

from ...core.config import settings
from ...domain.value_objects.risk_score import PredictionResult

logger = logging.getLogger(__name__)


@dataclass
class ModelMetadata:
    name: str
    version: str
    type: str
    path: str
    metrics: Optional[dict] = None
    feature_columns: Optional[list[str]] = None


class BaseMLModel(ABC):
    """Abstract base class for all ML models."""

    def __init__(self, metadata: ModelMetadata):
        self.metadata = metadata
        self.model = None

    @abstractmethod
    async def load(self) -> None:
        """Load model from storage."""
        pass

    @abstractmethod
    async def predict(self, features: Any) -> Any:
        """Run prediction. Returns anomaly scores or probabilities."""
        pass

    @abstractmethod
    async def predict_proba(self, features: Any) -> Any:
        """Return probability estimates."""
        pass

    def preprocess(self, features: dict[str, float] | Any) -> Any:
        if isinstance(features, dict):
            if self.metadata.feature_columns:
                return np.array([[
                    features.get(col, 0.0) for col in self.metadata.feature_columns
                ]])
            return np.array([list(features.values())])
        return features

    def get_feature_importance(self) -> Optional[dict[str, float]]:
        return None


class IsolationForestModel(BaseMLModel):
    async def load(self) -> None:
        path = Path(self.metadata.path)
        if path.suffix == '.pkl':
            with open(path, 'rb') as f:
                self.model = pickle.load(f)
        elif path.suffix == '.joblib':
            import joblib
            self.model = joblib.load(path)
        else:
            from sklearn.ensemble import IsolationForest
            self.model = IsolationForest(
                contamination=0.1,
                random_state=42,
                n_estimators=100,
            )
            logger.warning("No model file found, using default IsolationForest")

    async def predict(self, features: Any) -> Any:
        features = self.preprocess(features)
        scores = self.model.score_samples(features)
        return -scores

    async def predict_proba(self, features: Any) -> Any:
        features = self.preprocess(features)
        scores = self.model.score_samples(features)
        probas = 1 / (1 + np.exp(-(-scores)))
        return np.column_stack([1 - probas, probas])


class RandomForestModel(BaseMLModel):
    async def load(self) -> None:
        path = Path(self.metadata.path)
        if path.exists():
            with open(path, 'rb') as f:
                self.model = pickle.load(f)
        else:
            from sklearn.ensemble import RandomForestClassifier
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
            )
            logger.warning("No model file found, using default RandomForest")

    async def predict(self, features: Any) -> Any:
        features = self.preprocess(features)
        return self.model.predict(features)

    async def predict_proba(self, features: Any) -> Any:
        features = self.preprocess(features)
        return self.model.predict_proba(features)

    def get_feature_importance(self) -> Optional[dict[str, float]]:
        if self.model and hasattr(self.model, 'feature_importances_'):
            return {
                self.metadata.feature_columns[i] if self.metadata.feature_columns else f"feature_{i}": float(v)
                for i, v in enumerate(self.model.feature_importances_)
            }
        return None


class XGBoostModel(BaseMLModel):
    async def load(self) -> None:
        path = Path(self.metadata.path)
        if path.exists():
            import xgboost as xgb
            self.model = xgb.XGBClassifier()
            self.model.load_model(str(path))
        else:
            import xgboost as xgb
            self.model = xgb.XGBClassifier(
                n_estimators=100,
                max_depth=6,
                learning_rate=0.1,
                random_state=42,
            )
            logger.warning("No model file found, using default XGBoost")

    async def predict(self, features: Any) -> Any:
        features = self.preprocess(features)
        return self.model.predict(features)

    async def predict_proba(self, features: Any) -> Any:
        features = self.preprocess(features)
        return self.model.predict_proba(features)

    def get_feature_importance(self) -> Optional[dict[str, float]]:
        if self.model and hasattr(self.model, 'feature_importances_'):
            return {
                self.metadata.feature_columns[i] if self.metadata.feature_columns else f"feature_{i}": float(v)
                for i, v in enumerate(self.model.feature_importances_)
            }
        return None


class EnsembleModel(BaseMLModel):
    """
    Ensemble of multiple models.
    Averages predictions from all loaded models.
    """

    def __init__(self, metadata: ModelMetadata, models: list[BaseMLModel]):
        super().__init__(metadata)
        self.models = models

    async def load(self) -> None:
        for model in self.models:
            await model.load()

    async def predict(self, features: Any) -> Any:
        predictions = []
        for model in self.models:
            pred = await model.predict(features)
            predictions.append(pred)
        return np.mean(predictions, axis=0)

    async def predict_proba(self, features: Any) -> Any:
        probas = []
        for model in self.models:
            proba = await model.predict_proba(features)
            probas.append(proba)
        return np.mean(probas, axis=0)


class ModelRegistry:
    """
    Registry of available ML models.
    Models are loaded lazily and cached.
    """

    def __init__(self):
        self._models: dict[str, BaseMLModel] = {}
        self._model_path = Path(settings.ML_MODEL_PATH)
        self._model_path.mkdir(parents=True, exist_ok=True)

    def register(self, name: str, model: BaseMLModel) -> None:
        self._models[name] = model
        logger.info("Registered model: %s v%s", name, model.metadata.version)

    async def get(self, name: str) -> Optional[BaseMLModel]:
        model = self._models.get(name)
        if model:
            return model
        logger.warning("Model not found: %s", name)
        return None

    def list_models(self) -> list[ModelMetadata]:
        return [m.metadata for m in self._models.values()]

    def load_default_ensemble(self) -> EnsembleModel:
        metadata = ModelMetadata(
            name="ensemble_default",
            version="1.0.0",
            type="ensemble",
            path=str(self._model_path / "ensemble"),
        )
        models = [
            IsolationForestModel(ModelMetadata(
                name="isolation_forest",
                version="1.0.0",
                type="isolation_forest",
                path=str(self._model_path / "isolation_forest.pkl"),
            )),
            RandomForestModel(ModelMetadata(
                name="random_forest",
                version="1.0.0",
                type="random_forest",
                path=str(self._model_path / "random_forest.pkl"),
            )),
            XGBoostModel(ModelMetadata(
                name="xgboost",
                version="1.0.0",
                type="xgboost",
                path=str(self._model_path / "xgboost.json"),
            )),
        ]
        ensemble = EnsembleModel(metadata, models)
        self.register("ensemble_default", ensemble)
        return ensemble


model_registry = ModelRegistry()
