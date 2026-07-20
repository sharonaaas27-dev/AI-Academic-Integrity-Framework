import logging
import uuid
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from ...domain.events.behavior_events import EventBatch, BehaviorEvent
from ...models.sqlalchemy.behavior import RawBehaviorEvent
from ...core.cache import cache
from ...core.config import settings

logger = logging.getLogger(__name__)


class BehaviorEventHandler:
    async def process_batch(
        self,
        batch: EventBatch,
        db: AsyncSession,
    ) -> None:
        try:
            raw_events = []
            for event_data in batch.events:
                if isinstance(event_data, dict):
                    event = BehaviorEvent.from_dict(event_data)
                elif isinstance(event_data, BehaviorEvent):
                    event = event_data
                else:
                    continue

                raw_event = RawBehaviorEvent(
                    exam_id=uuid.UUID(event.exam_id or batch.exam_id),
                    student_id=uuid.UUID(event.student_id or batch.student_id),
                    session_id=event.session_id or batch.session_id,
                    event_type=event.event_type,
                    event_data=event.data,
                    client_timestamp=event.timestamp,
                    server_timestamp=datetime.now(timezone.utc).timestamp(),
                    processed=False,
                    batch_id=batch.batch_id,
                )
                raw_events.append(raw_event)

            if raw_events:
                db.add_all(raw_events)
                await db.flush()

                # Queue for feature engineering (best-effort)
                for event in raw_events:
                    try:
                        await cache.lpush(
                            "behavior:pending_features",
                            {
                                "event_id": str(event.id),
                                "exam_id": str(event.exam_id),
                                "student_id": str(event.student_id),
                                "session_id": event.session_id,
                                "event_type": event.event_type,
                                "client_timestamp": event.client_timestamp,
                            },
                        )
                    except Exception:
                        logger.warning(
                            "Failed to queue event %s for feature engineering",
                            event.id,
                            exc_info=True,
                        )

                logger.info(
                    "Processed batch %s: %d events",
                    batch.batch_id,
                    len(raw_events),
                )

        except Exception as e:
            logger.error(
                "Failed to process batch %s: %s",
                batch.batch_id,
                str(e),
                exc_info=True,
            )
            raise

    async def get_pending_events(
        self,
        exam_id: str,
        student_id: str,
        limit: int = 100,
    ) -> list[dict]:
        events = await cache.rpop(
            f"behavior:queue:{exam_id}:{student_id}",
            count=limit,
        )
        return events or []
