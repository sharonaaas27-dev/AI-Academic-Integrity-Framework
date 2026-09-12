from pydantic_settings import BaseSettings
from pydantic import Field, RedisDsn
from typing import Optional
from enum import Enum


class Environment(str, Enum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "AI Academic Integrity Framework"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: Environment = Environment.DEVELOPMENT
    DEBUG: bool = False
    LOG_LEVEL: LogLevel = LogLevel.INFO

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/academic_integrity"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_ECHO: bool = False

    # Redis
    REDIS_URL: RedisDsn = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 3600
    REDIS_SESSION_TTL: int = 86400

    # MinIO (Object Storage)
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET_EXAM_DATA: str = "exam-data"
    MINIO_BUCKET_ML_MODELS: str = "ml-models"
    MINIO_BUCKET_LOGS: str = "audit-logs"
    MINIO_SECURE: bool = False

    # JWT
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ROTATION_ENABLED: bool = True

    # Security
    CSRF_SECRET: str = "change-me-in-production"
    BCRYPT_ROUNDS: int = 12
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    SESSION_COOKIE_SECURE: bool = True
    SESSION_COOKIE_HTTPONLY: bool = True
    SESSION_COOKIE_SAMESITE: str = "Lax"

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # Email
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: Optional[int] = None
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    EMAIL_VERIFICATION_REQUIRED: bool = True

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 10
    WS_MAX_CLIENTS: int = 10000

    # Behavior SDK
    BEHAVIOR_BUFFER_SIZE: int = 100
    BEHAVIOR_FLUSH_INTERVAL: int = 5
    BEHAVIOR_MAX_BATCH_SIZE: int = 500
    BEHAVIOR_OFFLINE_BUFFER_KEY: str = "behavior:offline:"

    # ML / Risk Engine
    ML_MODEL_PATH: str = "ml/models"
    ML_CONFIDENCE_THRESHOLD: float = 0.7
    ML_PREDICTION_BATCH_SIZE: int = 32
    RISK_WEIGHT_RULES: float = 0.3
    RISK_WEIGHT_ML: float = 0.5
    RISK_WEIGHT_CONTEXT: float = 0.2
    RISK_HIGH_THRESHOLD: int = 61
    RISK_CRITICAL_THRESHOLD: int = 81

    # Rules Engine
    RULES_CACHE_TTL: int = 300
    RULES_DEFAULT_RULES: str = "rules/default_rules.json"

    # Feature Engineering
    FEATURE_WINDOW_SECONDS: int = 60
    FEATURE_IDLE_THRESHOLD_SECONDS: int = 30

    # Notification
    NOTIFICATION_EMAIL_ENABLED: bool = False
    NOTIFICATION_WEBHOOK_ENABLED: bool = False
    NOTIFICATION_IN_APP_ENABLED: bool = True

    # Audit
    AUDIT_LOG_RETENTION_DAYS: int = 365
    AUDIT_LOG_BATCH_SIZE: int = 100

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
