import logging
import uuid
from typing import Any, Optional
from uuid import UUID, uuid4
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import select, desc
from sqlalchemy.orm import selectinload
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
from ....services.jobs.job_queue import RiskRecalcJob, risk_job_queue
from ....services.realtime.broadcaster import broadcast_alert
from ....services.risk.reporting import enrich_top_features, calibration_sample_kwargs, save_calibration_sample
from ....domain.enums import SUSPICIOUS_EVENT_TYPES
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
    NOTE: unauthenticated by design (SDK has no token); validated strictly.
    """
    if not batch.exam_id or not batch.student_id:
        raise HTTPException(status_code=400, detail="exam_id and student_id are required")
    if len(batch.events) == 0:
        raise HTTPException(status_code=400, detail="events batch is empty")
    if len(batch.events) > settings.BEHAVIOR_MAX_BATCH_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"Batch too large (max {settings.BEHAVIOR_MAX_BATCH_SIZE})",
        )
    try:
        UUID(batch.exam_id)
        UUID(batch.student_id)
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid exam_id or student_id (must be UUID)")
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

        # Queue background risk recalculation (bounded, coalesced).
        # Never blocks the response; drops are counted + logged in the queue.
        await risk_job_queue.enqueue(
            exam_id=domain_batch.exam_id,
            student_id=domain_batch.student_id,
        )

        # Live-push suspicious events to subscribed teachers (best-effort;
        # polling remains the fallback, so failures are only logged).
        try:
            for e in domain_batch.events:
                if (e.event_type or "") in SUSPICIOUS_EVENT_TYPES:
                    await broadcast_alert(
                        exam_id=domain_batch.exam_id,
                        student_id=domain_batch.student_id,
                        student_name="",
                        event_type=e.event_type or "unknown",
                        timestamp_ms=float(e.timestamp or 0.0),
                    )
                    break  # one push per batch; teachers re-fetch the feed
        except Exception:
            logger.warning("Alert broadcast failed for %s/%s", domain_batch.exam_id, domain_batch.student_id)

        return {
            "status": "accepted",
            "batch_id": domain_batch.batch_id,
            "event_count": len(domain_batch.events),
            "message": "Events received and queued for processing",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to process behavior batch: %s", str(e), exc_info=True)
        return JSONResponse(
            status_code=500,
            content={"status": "error", "message": "Failed to process events"},
        )


async def handle_risk_recalc_job(job: RiskRecalcJob) -> Optional[dict[str, Any]]:
    """Queue worker handler: recalculate risk for one student in one exam.

    Returns the saved report summary (for post-save hooks such as realtime
    push), or None when no report was produced.
    """
    exam_id, student_id = job.exam_id, job.student_id
    try:
        try:
            exam_uuid = UUID(exam_id)
            student_uuid = UUID(student_id)
        except (ValueError, TypeError, AttributeError):
            logger.warning("Skipping risk recalc: invalid UUIDs %s/%s", exam_id, student_id)
            return None
        async with async_session_factory() as db:
            result = await db.execute(
                select(ExamEnrollment)
                .where(
                    ExamEnrollment.exam_id == exam_uuid,
                    ExamEnrollment.student_id == student_uuid,
                )
                .options(selectinload(ExamEnrollment.exam))
            )
            enrollment = result.scalar_one_or_none()
            if not enrollment or not enrollment.exam:
                logger.warning("Cannot recalculate risk: enrollment/exam not found for %s/%s", exam_id, student_id)
                return None

            exam = enrollment.exam

            events_result = await db.execute(
                select(RawBehaviorEvent)
                .where(
                    RawBehaviorEvent.exam_id == exam_uuid,
                    RawBehaviorEvent.student_id == student_uuid,
                )
                .order_by(RawBehaviorEvent.client_timestamp)
            )
            raw_events = events_result.scalars().all()

            if not raw_events:
                return None

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
                return None

            try:
                risk_score = await risk_engine.calculate_risk(
                    exam_id=exam_uuid,
                    student_id=student_uuid,
                    institution_id=exam.institution_id,
                    features=features,
                    exam_difficulty=exam.difficulty_level or "medium",
                )
            except Exception as e:
                logger.error("Risk calculation failed for %s/%s: %s", exam_id, student_id, str(e), exc_info=True)
                return None

            try:
                timeline = timeline_engine.build_timeline(event_dicts)
                explanation = explainer.generate_explanation(risk_score, features, timeline)
            except Exception as e:
                logger.error("Timeline/explanation failed for %s/%s: %s", exam_id, student_id, str(e), exc_info=True)
                return None

            report = RiskReport(
                exam_id=exam_uuid,
                student_id=student_uuid,
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
                top_features=await enrich_top_features(features, risk_score.top_features),
                rule_triggers=risk_score.rule_triggers,
                explanation=explanation["summary"],
            )
            db.add(report)
            await db.flush()  # assign report.id for the calibration sample
            await save_calibration_sample(db, calibration_sample_kwargs(
                exam_id=exam_uuid,
                institution_id=exam.institution_id,
                report_id=report.id,
                exam_difficulty=exam.difficulty_level or "medium",
                features=features,
                overall_score=risk_score.overall_score,
                risk_level=risk_score.risk_level.value,
                rule_score=risk_score.components.rule_score,
                ml_score=risk_score.components.ml_score,
                context_score=risk_score.components.context_score,
            ))
            await db.commit()

            logger.info(
                "Recalculated risk for exam=%s student=%s: score=%s level=%s",
                exam_id, student_id, risk_score.overall_score, risk_score.risk_level.value,
            )
            return {
                "report_id": str(report.id),
                "exam_id": str(exam_uuid),
                "student_id": str(student_uuid),
                "overall_score": risk_score.overall_score,
                "risk_level": risk_score.risk_level.value,
            }

    except Exception as e:
        logger.error("Failed to recalculate risk for %s/%s: %s", exam_id, student_id, str(e), exc_info=True)
        raise


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
    try:
        exam_uuid = uuid.UUID(exam_id)
        student_uuid = uuid.UUID(student_id)
    except (ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=400, detail="Invalid exam_id or student_id")
    limit = max(1, min(limit, 500))
    offset = max(0, offset)
    query = (
        select(RawBehaviorEvent)
        .where(
            RawBehaviorEvent.exam_id == exam_uuid,
            RawBehaviorEvent.student_id == student_uuid,
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
