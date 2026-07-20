import logging
import sys
from pathlib import Path

from .config import settings


def setup_logging() -> None:
    log_format = (
        "%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s"
    )

    handlers = [logging.StreamHandler(sys.stdout)]
    try:
        log_dir = Path("logs")
        log_dir.mkdir(parents=True, exist_ok=True)
        handlers.append(
            logging.FileHandler(
                log_dir / f"{settings.APP_NAME.lower().replace(' ', '_')}.log"
            )
        )
    except OSError:
        pass

    logging.basicConfig(
        level=getattr(logging, settings.LOG_LEVEL.value.upper(), logging.INFO),
        format=log_format,
        handlers=handlers,
    )

    # Disable noisy loggers
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("asyncio").setLevel(logging.WARNING)

    logging.info(
        "Logging configured for %s environment",
        settings.ENVIRONMENT.value,
    )


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
