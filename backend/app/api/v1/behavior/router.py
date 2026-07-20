import asyncio
import logging
import uuid
from uuid import UUID
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.database import get_db, async_session_factory
from ....core.cache import cache
from ....core.config import settings
from ....domain.events.behavior_events import BehaviorEvent, EventBatch
from ....models.pydantic.behavior import BehaviorBatchCreate, BehaviorEventCreate
from ....models.sqlalchemy.behavior import RawBehaviorEvent
from ....models.sqlalchemy.exam import ExamEnrollment
from ....models.sqlalchemy.risk import RiskReport
from ....services.behavior.event_handler import BehaviorEventHandler
from ....services.risk.risk_engine import risk_engine
from ....services.feature_engineering.feature_engine import feature_engine
from ....services.explainable_ai.explainer import explainer
from ....services.timeline.timeline_engine import timeline_engine

logger = logging.getLogger(__name__)
router = APIRouter()
event_handler = BehaviorEventHandler()


@router.post("/events")
async def submit_behavior_events(
    batch: BehaviorBatchCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive a batch of behavior events from the SDK.
    Events are validated, queued, and stored for processing.
    """
    try:
        domain_batch = EventBatch(
            batch_id=batch.batch_id or str(uuid4()),
            exam_id=batch.exam_id,
            student_id=batch.student_id,
            session_id=batch.session_id,
            events=[
                BehaviorEvent(
                    event_type=e.event_type,
                    timestamp=e.timestamp,
                    data=e.data,
                    metadata=e.metadata,
                )
                for e in batch.events
            ],
            client_sent_at=batch.client_sent_at,
        )
        await event_handler.process_batch(batch=domain_batch, db=db)
        logger.info(
            "Accepted behavior batch: %s (%d events, exam=%s, student=%s)",
            domain_batch.batch_id, len(domain_batch.events),
            domain_batch.exam_id, domain_batch.student_id,
        )

        # Trigger background risk recalculation
        asyncio.create_task(
            _recalculate_risk_background(
                exam_id=domain_batch.exam_id,
                student_id=domain_batch.student_id,
            )
        )

        return {
            "status": "accepted",
            "batch_id": domain_batch.batch_id,
            "event_count": len(domain_batch.events),
            "message": "Events received and queued for processing",
        }
    except Exception as e:
        logger.error("Failed to process behavior batch: %s", str(e), exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Failed to process events"},
        )


async def _recalculate_risk_background(exam_id: str, student_id: str):
    """Recalculate risk score for a student in an exam after new events arrive."""
    try:
        async with async_session_factory() as db:
            result = await db.execute(
                select(ExamEnrollment)
                .where(
                    ExamEnrollment.exam_id == UUID(exam_id),
                    ExamEnrollment.student_id == UUID(student_id),
                )
                .options(selectinload(ExamEnrollment.exam))
            )
            enrollment = result.scalar_one_or_none()
            if not enrollment or not enrollment.exam:
                logger.warning("Cannot recalculate risk: enrollment/exam not found for %s/%s", exam_id, student_id)
                return

            exam = enrollment.exam

            events_result = await db.execute(
                select(RawBehaviorEvent)
                .where(
                    RawBehaviorEvent.exam_id == UUID(exam_id),
                    RawBehaviorEvent.student_id == UUID(student_id),
                )
                .order_by(RawBehaviorEvent.client_timestamp)
            )
            raw_events = events_result.scalars().all()

            if not raw_events:
                return

            event_dicts = [
                {
                    "event_type": e.event_type,
                    "event_data": e.event_data,
                    "data": e.event_data,
                    "client_timestamp": e.client_timestamp,
                }
                for e in raw_events
            ]

            try:
                features = feature_engine.extract_features(
                    event_dicts,
                    exam_duration_seconds=exam.duration_minutes * 60 if exam.duration_minutes else None,
                )
            except Exception as e:
                logger.error("Feature extraction failed for %s/%s: %s", exam_id, student_id, str(e), exc_info=True)
                return

            try:
                risk_score = await risk_engine.calculate_risk(
                    exam_id=UUID(exam_id),
                    student_id=UUID(student_id),
                    institution_id=exam.institution_id,
                    features=features,
                    exam_difficulty=exam.difficulty_level or "medium",
                )
            except Exception as e:
                logger.error("Risk calculation failed for %s/%s: %s", exam_id, student_id, str(e), exc_info=True)
                return

            try:
                timeline = timeline_engine.build_timeline(event_dicts)
                explanation = explainer.generate_explanation(risk_score, features, timeline)
            except Exception as e:
                logger.error("Timeline/explanation failed for %s/%s: %s", exam_id, student_id, str(e), exc_info=True)
                return

            report = RiskReport(
                exam_id=UUID(exam_id),
                student_id=UUID(student_id),
                enrollment_id=enrollment.id,
                institution_id=exam.institution_id,
                overall_score=risk_score.overall_score,
                risk_level=risk_score.risk_level.value,
                rule_score=risk_score.components.rule_score,
                ml_score=risk_score.components.ml_score,
                context_score=risk_score.components.context_score,
                model_name=risk_score.prediction.model_name if risk_score.prediction else None,
                model_version=risk_score.prediction.model_version if risk_score.prediction else None,
                anomaly_score=risk_score.prediction.anomaly_score if risk_score.prediction else None,
                ml_confidence=risk_score.confidence,
                ml_probability=risk_score.prediction.probability if risk_score.prediction else None,
                is_anomaly=risk_score.prediction.is_anomaly if risk_score.prediction else None,
                top_features=risk_score.top_features,
                rule_triggers=risk_score.rule_triggers,
                explanation=explanation["summary"],
            )
            db.add(report)
            await db.commit()

            logger.info(
                "Recalculated risk for exam=%s student=%s: score=%s level=%s",
                exam_id, student_id, risk_score.overall_score, risk_score.risk_level.value,
            )

    except Exception as e:
        logger.error("Failed to recalculate risk for %s/%s: %s", exam_id, student_id, str(e), exc_info=True)


@router.websocket("/ws/{exam_id}/{student_id}/{session_id}")
async def behavior_websocket(
    websocket: WebSocket,
    exam_id: str,
    student_id: str,
    session_id: str,
):
    """
    WebSocket endpoint for real-time behavior streaming.
    """
    await websocket.accept()
    logger.info(
        "WebSocket connected: exam=%s student=%s session=%s",
        exam_id, student_id, session_id,
    )

    try:
        while True:
            data = await websocket.receive_json()
            event = BehaviorEvent.from_dict(data)
            event.exam_id = exam_id
            event.student_id = student_id
            event.session_id = session_id

            # Store to Redis queue for async processing
            await cache.lpush(
                f"behavior:queue:{exam_id}:{student_id}",
                event.to_dict(),
            )

            # Send acknowledgment
            await websocket.send_json({
                "status": "ok",
                "event_id": event.event_id,
            })

    except WebSocketDisconnect:
        logger.info(
            "WebSocket disconnected: exam=%s student=%s",
            exam_id, student_id,
        )
    except Exception as e:
        logger.error("WebSocket error: %s", str(e))
        await websocket.close(code=1011)


@router.get("/events/{exam_id}/{student_id}")
async def get_student_events(
    exam_id: str,
    student_id: str,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieve stored behavior events for a specific student and exam.
    """
    query = (
        select(RawBehaviorEvent)
        .where(
            RawBehaviorEvent.exam_id == uuid.UUID(exam_id),
            RawBehaviorEvent.student_id == uuid.UUID(student_id),
        )
        .order_by(desc(RawBehaviorEvent.client_timestamp))
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(query)
    events = result.scalars().all()

    return {
        "total": len(events),
        "events": [
            {
                "id": str(e.id),
                "event_type": e.event_type,
                "event_data": e.event_data,
                "client_timestamp": e.client_timestamp,
                "server_timestamp": e.server_timestamp,
            }
            for e in events
        ],
    }
