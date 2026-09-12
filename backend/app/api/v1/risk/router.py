from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import Optional
from uuid import UUID

from ....core.database import get_db
from ....api.deps import get_current_user, require_role
from ....domain.enums import UserRole, RiskLevel
from ....domain.value_objects.risk_score import RiskScore
from ....models.sqlalchemy.risk import RiskReport, RiskCalibrationSample
from ....models.sqlalchemy.exam import ExamEnrollment
from ....models.sqlalchemy.user import User
from ....models.sqlalchemy.behavior import RawBehaviorEvent, ProcessedFeature
from ....services.risk.risk_engine import risk_engine
from ....services.risk.reporting import enrich_top_features, calibration_sample_kwargs, save_calibration_sample
from ....services.feature_engineering.feature_engine import feature_engine
from ....services.explainable_ai.explainer import explainer
from ....services.timeline.timeline_engine import timeline_engine

router = APIRouter()


@router.get("/report/{exam_id}/{student_id}")
async def get_risk_report(
    exam_id: UUID,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.EXAM_CONTROLLER])
    ),
):
    """Get the latest risk report for a student in an exam."""
    result = await db.execute(
        select(RiskReport)
        .where(
            RiskReport.exam_id == exam_id,
            RiskReport.student_id == student_id,
        )
        .order_by(desc(RiskReport.generated_at))
        .limit(1)
    )
    report = result.scalar_one_or_none()

    if not report:
        raise HTTPException(status_code=404, detail="No risk report found")

    return {
        "id": str(report.id),
        "overall_score": report.overall_score,
        "risk_level": report.risk_level,
        "components": {
            "rule_score": report.rule_score,
            "ml_score": report.ml_score,
            "context_score": report.context_score,
        },
        "explanation": report.explanation,
        "top_features": report.top_features,
        "rule_triggers": report.rule_triggers,
        "ml_confidence": report.ml_confidence,
        "generated_at": report.generated_at.isoformat(),
    }


@router.post("/calculate/{exam_id}/{student_id}")
async def calculate_risk_score(
    exam_id: UUID,
    student_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.EXAM_CONTROLLER])
    ),
):
    """Calculate a fresh risk score for a student in an exam."""
    # Get enrollment
    result = await db.execute(
        select(ExamEnrollment).where(
            ExamEnrollment.exam_id == exam_id,
            ExamEnrollment.student_id == student_id,
        )
    )
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # Get raw events
    events_result = await db.execute(
        select(RawBehaviorEvent)
        .where(
            RawBehaviorEvent.exam_id == exam_id,
            RawBehaviorEvent.student_id == student_id,
        )
        .order_by(RawBehaviorEvent.client_timestamp)
    )
    raw_events = events_result.scalars().all()

    # Convert to dicts
    event_dicts = [
        {
            "event_type": e.event_type,
            "event_data": e.event_data,
            "data": e.event_data,
            "client_timestamp": e.client_timestamp,
        }
        for e in raw_events
    ]

    # Extract features
    features = feature_engine.extract_features(
        event_dicts,
        exam_duration_seconds=enrollment.exam.duration_minutes * 60
        if enrollment.exam and enrollment.exam.duration_minutes
        else None,
    )

    # Calculate risk
    risk_score = await risk_engine.calculate_risk(
        exam_id=exam_id,
        student_id=student_id,
        institution_id=current_user.institution_id,
        features=features,
        exam_difficulty=enrollment.exam.difficulty_level
        if enrollment.exam else "medium",
    )

    # Build timeline
    timeline = timeline_engine.build_timeline(event_dicts)

    # Generate explanation
    explanation = explainer.generate_explanation(risk_score, features, timeline)

    # Store report
    exam_difficulty = enrollment.exam.difficulty_level if enrollment.exam else "medium"
    report = RiskReport(
        exam_id=exam_id,
        student_id=student_id,
        enrollment_id=enrollment.id,
        institution_id=current_user.institution_id,
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
    await db.flush()
    await save_calibration_sample(db, calibration_sample_kwargs(
        exam_id=exam_id,
        institution_id=current_user.institution_id,
        report_id=report.id,
        exam_difficulty=exam_difficulty,
        features=features,
        overall_score=risk_score.overall_score,
        risk_level=risk_score.risk_level.value,
        rule_score=risk_score.components.rule_score,
        ml_score=risk_score.components.ml_score,
        context_score=risk_score.components.context_score,
    ))
    await db.flush()

    return {
        "report_id": str(report.id),
        "risk_score": risk_score.to_dict(),
        "features": features,
        "explanation": explanation,
        "timeline": {
            "entries": timeline[:50],  # Limit to 50 entries
            "summary": timeline_engine.build_summary(timeline),
        },
    }


@router.get("/students/{exam_id}")
async def get_exam_risk_overview(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.EXAM_CONTROLLER])
    ),
):
    """Get risk overview for all students in an exam."""
    # SQLite-compatible latest-per-student: order by time desc, dedupe in Python
    # (Postgres DISTINCT ON is not portable).
    result = await db.execute(
        select(RiskReport)
        .where(RiskReport.exam_id == exam_id)
        .order_by(RiskReport.student_id, desc(RiskReport.generated_at))
    )
    all_reports = result.scalars().all()
    seen: set[str] = set()
    reports = []
    for r in all_reports:
        key = str(r.student_id)
        if key not in seen:
            seen.add(key)
            reports.append(r)

    return {
        "exam_id": str(exam_id),
        "total_students": len(reports),
        "students": [
            {
                "student_id": str(r.student_id),
                "overall_score": r.overall_score,
                "risk_level": r.risk_level,
                "ml_confidence": r.ml_confidence,
                "generated_at": r.generated_at.isoformat(),
            }
            for r in reports
        ],
    }


@router.get("/calibration/summary")
async def get_calibration_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.EXAM_CONTROLLER])
    ),
):
    """Aggregate calibration samples by exam difficulty.

    The raw material for future per-exam-type threshold tuning: how many
    scored samples exist per difficulty band and their mean scores.
    Grows as reports are saved; empty until real exams run.
    """
    rows = await db.execute(
        select(
            RiskCalibrationSample.exam_difficulty,
            func.count(RiskCalibrationSample.id),
            func.avg(RiskCalibrationSample.overall_score),
        )
        .where(RiskCalibrationSample.institution_id == current_user.institution_id)
        .group_by(RiskCalibrationSample.exam_difficulty)
    )
    by_difficulty = [
        {"difficulty": d, "samples": int(n), "mean_score": round(float(m or 0.0), 2)}
        for d, n, m in rows.all()
    ]
    total = sum(b["samples"] for b in by_difficulty)
    return {
        "total_samples": total,
        "by_difficulty": by_difficulty,
        "note": "Thresholds stay global until per-band samples justify tuning.",
    }
