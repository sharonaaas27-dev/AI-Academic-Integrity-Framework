from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import Optional
from uuid import UUID

from ....core.database import get_db
from ....api.deps import get_current_user, require_role
from ....domain.enums import UserRole
from ....models.sqlalchemy.exam import Exam, ExamEnrollment
from ....models.sqlalchemy.risk import RiskReport
from ....models.sqlalchemy.behavior import RawBehaviorEvent
from ....models.sqlalchemy.user import User

router = APIRouter()


@router.get("/overview")
async def get_analytics_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN])
    ),
):
    # Risk distribution
    risk_counts = await db.execute(
        select(RiskReport.risk_level, func.count(RiskReport.id))
        .group_by(RiskReport.risk_level)
    )
    distribution = {row[0]: row[1] for row in risk_counts}

    # Exam status distribution
    exam_status = await db.execute(
        select(Exam.status, func.count(Exam.id))
        .group_by(Exam.status)
    )
    exam_distribution = {
        str(row[0]): row[1] if hasattr(row[1], '__int__') else row[1]
        for row in exam_status
    }

    # Recent event volume (last 24h)
    event_volume = await db.scalar(
        select(func.count(RawBehaviorEvent.id)).where(
            RawBehaviorEvent.server_timestamp
            > (func.extract("epoch", func.now()) - 86400)
        )
    )

    return {
        "risk_distribution": distribution,
        "exam_status_distribution": exam_distribution,
        "total_risk_reports": sum(distribution.values()),
        "events_last_24h": event_volume or 0,
        "total_exams": sum(exam_distribution.values()),
    }


@router.get("/exam/{exam_id}")
async def get_exam_analytics(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(
        require_role([UserRole.ADMIN, UserRole.TEACHER, UserRole.SUPER_ADMIN])
    ),
):
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()

    if not exam:
        return {"error": "Exam not found"}

    enrollments_result = await db.execute(
        select(ExamEnrollment).where(ExamEnrollment.exam_id == exam_id)
    )
    enrollments = enrollments_result.scalars().all()

    risk_result = await db.execute(
        select(RiskReport).where(RiskReport.exam_id == exam_id)
    )
    reports = risk_result.scalars().all()

    avg_score = sum(r.overall_score for r in reports) / len(reports) if reports else 0

    return {
        "exam": {
            "id": str(exam.id),
            "title": exam.title,
            "duration_minutes": exam.duration_minutes,
            "total_marks": exam.total_marks,
        },
        "enrollments": {
            "total": len(enrollments),
            "completed": sum(1 for e in enrollments if e.status == "completed"),
            "in_progress": sum(1 for e in enrollments if e.status == "active"),
        },
        "risk": {
            "average_score": round(avg_score, 2),
            "total_reports": len(reports),
            "high_risk": sum(1 for r in reports if r.risk_level in ("high", "critical")),
        },
    }
