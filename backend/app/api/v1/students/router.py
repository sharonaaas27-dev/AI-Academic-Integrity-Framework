from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from ....core.database import get_db
from ....api.deps import get_current_user
from ....models.sqlalchemy.exam import Exam, ExamEnrollment
from ....models.sqlalchemy.user import User

router = APIRouter()


@router.get("/exams")
async def get_student_exams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ExamEnrollment)
        .where(
            ExamEnrollment.student_id == current_user.id,
            ExamEnrollment.status.notin_(["completed", "submitted"]),
        )
        .order_by(desc(ExamEnrollment.created_at))
    )
    enrollments = result.scalars().all()

    exams = []
    for enrollment in enrollments:
        exam = await db.get(Exam, enrollment.exam_id)
        if exam and exam.status in ["active", "scheduled"]:
            exams.append({
                "id": str(exam.id),
                "title": exam.title,
                "duration_minutes": exam.duration_minutes,
                "start_time": exam.start_time.isoformat() if exam.start_time else None,
                "total_marks": exam.total_marks,
                "course_name": exam.course.name if exam.course else None,
            })

    return exams


@router.get("/history")
async def get_student_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ExamEnrollment)
        .where(
            ExamEnrollment.student_id == current_user.id,
            ExamEnrollment.status.in_(["completed", "submitted"]),
        )
        .order_by(desc(ExamEnrollment.submitted_at))
    )
    enrollments = result.scalars().all()

    history = []
    for enrollment in enrollments:
        exam = await db.get(Exam, enrollment.exam_id)
        history.append({
            "id": str(enrollment.id),
            "exam_id": str(enrollment.exam_id),
            "exam_title": exam.title if exam else "Unknown",
            "score": enrollment.score,
            "total_marks": enrollment.total_marks,
            "percentage": enrollment.percentage,
            "status": enrollment.status,
            "submitted_at": enrollment.submitted_at.isoformat() if enrollment.submitted_at else None,
            "time_taken_seconds": enrollment.time_taken_seconds,
        })

    return history
