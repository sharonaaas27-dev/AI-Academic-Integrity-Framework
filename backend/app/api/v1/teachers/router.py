from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, or_, func
from typing import Optional, List
from uuid import UUID
from datetime import datetime, timezone

from ....core.database import get_db
from ....api.deps import get_current_user, require_role
from ....domain.enums import UserRole, SUSPICIOUS_EVENT_TYPES
from ....models.sqlalchemy.exam import Exam, Question, ExamEnrollment, Course, Answer
from ....models.sqlalchemy.risk import RiskReport
from ....models.sqlalchemy.behavior import RawBehaviorEvent
from ....models.sqlalchemy.user import User

router = APIRouter()


@router.get("/students")
async def search_students(
    q: str = Query("", min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN, UserRole.EXAM_CONTROLLER])),
):
    result = await db.execute(
        select(User).where(
            User.institution_id == current_user.institution_id,
            User.role == UserRole.STUDENT,
            or_(
                User.first_name.ilike(f"%{q}%"),
                User.last_name.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%"),
            ),
        ).order_by(User.first_name, User.last_name).limit(20)
    )
    students = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "first_name": s.first_name,
            "last_name": s.last_name,
            "email": s.email,
            "full_name": f"{s.first_name} {s.last_name}",
        }
        for s in students
    ]


@router.get("/courses")
async def get_teacher_courses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Course).where(
            Course.institution_id == current_user.institution_id,
            Course.is_deleted == False,
        ).order_by(Course.name)
    )
    courses = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "name": c.name,
            "code": c.code,
            "department": c.department,
        }
        for c in courses
    ]


@router.get("/exams")
async def get_teacher_exams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Exam)
        .where(
            Exam.created_by == current_user.id,
            Exam.is_deleted == False,
        )
        .order_by(desc(Exam.created_at))
    )
    exams = result.scalars().all()

    return [
        {
            "id": str(e.id),
            "title": e.title,
            "status": e.status.value if hasattr(e.status, 'value') else e.status,
            "duration_minutes": e.duration_minutes,
            "total_marks": e.total_marks,
            "start_time": e.start_time.isoformat() if e.start_time else None,
            "student_count": len(e.enrollments) if hasattr(e, 'enrollments') else 0,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in exams
    ]


@router.get("/exams/{exam_id}/submissions")
async def get_exam_submissions(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = await db.get(Exam, exam_id)
    if not exam or (exam.created_by != current_user.id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.EXAM_CONTROLLER)):
        raise HTTPException(status_code=404, detail="Exam not found")

    result = await db.execute(
        select(ExamEnrollment)
        .where(ExamEnrollment.exam_id == exam_id)
        .order_by(desc(ExamEnrollment.created_at))
    )
    enrollments = result.scalars().all()

    submissions = []
    for enrollment in enrollments:
        student = await db.get(User, enrollment.student_id)
        submissions.append({
            "enrollment_id": str(enrollment.id),
            "student_id": str(enrollment.student_id),
            "student_name": f"{student.first_name} {student.last_name}" if student else "Unknown",
            "student_email": student.email if student else "",
            "status": enrollment.status,
            "score": enrollment.score,
            "total_marks": enrollment.total_marks,
            "percentage": enrollment.percentage,
            "time_taken_seconds": enrollment.time_taken_seconds,
            "risk_score": enrollment.risk_score,
            "risk_level": enrollment.risk_level,
            "submitted_at": enrollment.submitted_at.isoformat() if enrollment.submitted_at else None,
        })

    return submissions


@router.get("/live/{exam_id}/students")
async def get_live_students(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = await db.get(Exam, exam_id)
    if not exam or (exam.created_by != current_user.id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.EXAM_CONTROLLER)):
        raise HTTPException(status_code=404, detail="Exam not found")

    result = await db.execute(
        select(ExamEnrollment).where(ExamEnrollment.exam_id == exam_id)
    )
    enrollments = result.scalars().all()

    students = []
    for enrollment in enrollments:
        student = await db.get(User, enrollment.student_id)
        question_count_result = await db.execute(
            select(func.count(Answer.id)).where(
                Answer.enrollment_id == enrollment.id,
            )
        )
        answered_count = question_count_result.scalar() or 0

        total_questions_result = await db.execute(
            select(func.count(Question.id)).where(
                Question.exam_id == exam_id,
                Question.is_deleted == False,
            )
        )
        total_questions = total_questions_result.scalar() or 0

        risk = await db.execute(
            select(RiskReport)
            .where(
                RiskReport.enrollment_id == enrollment.id,
            )
            .order_by(desc(RiskReport.generated_at))
            .limit(1)
        )
        latest_risk = risk.scalar_one_or_none()

        risk_history = await db.execute(
            select(RiskReport.overall_score, RiskReport.generated_at)
            .where(
                RiskReport.enrollment_id == enrollment.id,
            )
            .order_by(RiskReport.generated_at.asc())
            .limit(50)
        )
        risk_scores = [{"score": r[0], "time": r[1].isoformat() if r[1] else None} for r in risk_history.fetchall()]

        students.append({
            "student_id": str(enrollment.student_id),
            "student_name": f"{student.first_name} {student.last_name}" if student else "Unknown",
            "student_email": student.email if student else "",
            "status": enrollment.status,
            "started_at": enrollment.started_at.isoformat() if enrollment.started_at else None,
            "submitted_at": enrollment.submitted_at.isoformat() if enrollment.submitted_at else None,
            "answered_count": answered_count,
            "total_questions": total_questions,
            "time_taken_seconds": enrollment.time_taken_seconds,
            "risk_score": latest_risk.overall_score if latest_risk else 0,
            "risk_level": latest_risk.risk_level if latest_risk else "safe",
            "risk_score_history": risk_scores,
        })

    return students


@router.get("/live/{exam_id}/students/{student_id}")
async def get_live_student_detail(
    exam_id: UUID,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = await db.get(Exam, exam_id)
    if not exam or (exam.created_by != current_user.id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.EXAM_CONTROLLER)):
        raise HTTPException(status_code=404, detail="Exam not found")

    enrollment = await db.execute(
        select(ExamEnrollment).where(
            ExamEnrollment.exam_id == exam_id,
            ExamEnrollment.student_id == student_id,
        )
    )
    enrollment = enrollment.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    student = await db.get(User, student_id)

    answers_result = await db.execute(
        select(Answer).where(Answer.enrollment_id == enrollment.id)
    )
    answers = answers_result.scalars().all()

    questions_result = await db.execute(
        select(Question)
        .where(Question.exam_id == exam_id, Question.is_deleted == False)
        .order_by(Question.order_index)
    )
    questions = questions_result.scalars().all()

    events_result = await db.execute(
        select(RawBehaviorEvent)
        .where(
            RawBehaviorEvent.exam_id == exam_id,
            RawBehaviorEvent.student_id == student_id,
        )
        .order_by(desc(RawBehaviorEvent.client_timestamp))
        .limit(50)
    )
    events = events_result.scalars().all()

    risk_result = await db.execute(
        select(RiskReport)
        .where(RiskReport.enrollment_id == enrollment.id)
        .order_by(desc(RiskReport.generated_at))
    )
    risk_reports = risk_result.scalars().all()

    question_map = {str(q.id): q for q in questions}

    return {
        "student": {
            "id": str(student.id) if student else "",
            "name": f"{student.first_name} {student.last_name}" if student else "Unknown",
            "email": student.email if student else "",
        },
        "enrollment": {
            "status": enrollment.status,
            "started_at": enrollment.started_at.isoformat() if enrollment.started_at else None,
            "submitted_at": enrollment.submitted_at.isoformat() if enrollment.submitted_at else None,
            "time_taken_seconds": enrollment.time_taken_seconds,
            "score": enrollment.score,
            "total_marks": enrollment.total_marks,
            "percentage": enrollment.percentage,
        },
        "answers": [
            {
                "question_id": str(a.question_id),
                "question_text": question_map.get(str(a.question_id), Question()).text if question_map.get(str(a.question_id)) else "",
                "answer_text": a.answer_text,
                "is_correct": a.is_correct,
                "marks_obtained": a.marks_obtained,
                "time_spent_seconds": a.time_spent_seconds,
                "edit_count": a.edit_count,
            }
            for a in answers
        ],
        "events": [
            {
                "event_type": e.event_type,
                "event_data": e.event_data,
                "client_timestamp": e.client_timestamp,
                "server_timestamp": e.server_timestamp,
            }
            for e in events
        ],
        "risk_reports": [
            {
                "overall_score": r.overall_score,
                "risk_level": r.risk_level,
                "rule_score": r.rule_score,
                "ml_score": r.ml_score,
                "context_score": r.context_score,
                "rule_triggers": r.rule_triggers,
                "generated_at": r.generated_at.isoformat() if r.generated_at else None,
            }
            for r in risk_reports
        ] if risk_reports else [{
            "overall_score": 0,
            "risk_level": "safe",
            "rule_score": 0,
            "ml_score": 0,
            "context_score": 0,
            "rule_triggers": [],
            "generated_at": None,
        }],
    }


@router.get("/live/{exam_id}/alerts")
async def get_live_alerts(
    exam_id: UUID,
    minutes: int = Query(30, ge=1, le=120),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = await db.get(Exam, exam_id)
    if not exam or (exam.created_by != current_user.id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.EXAM_CONTROLLER)):
        raise HTTPException(status_code=404, detail="Exam not found")

    cutoff = datetime.now(timezone.utc).timestamp() - (minutes * 60)

    events_result = await db.execute(
        select(RawBehaviorEvent)
        .where(
            RawBehaviorEvent.exam_id == exam_id,
            RawBehaviorEvent.server_timestamp >= cutoff,
            RawBehaviorEvent.event_type.in_(list(SUSPICIOUS_EVENT_TYPES)),
        )
        .order_by(desc(RawBehaviorEvent.client_timestamp))
        .limit(100)
    )
    events = events_result.scalars().all()

    alerts = []
    for event in events:
        student = await db.get(User, event.student_id)
        alerts.append({
            "id": str(event.id),
            "student_id": str(event.student_id),
            "student_name": f"{student.first_name} {student.last_name}" if student else "Unknown",
            "event_type": event.event_type,
            "event_data": event.event_data,
            # Timestamps: client_timestamp is ms (JS Date.now()), server is s.
            "timestamp": event.client_timestamp,
            "timestamp_ms": event.client_timestamp,
            "server_timestamp": event.server_timestamp,
        })

    return alerts


@router.get("/live/{exam_id}/summary")
async def get_live_summary(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    exam = await db.get(Exam, exam_id)
    if not exam or (exam.created_by != current_user.id and current_user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.EXAM_CONTROLLER)):
        raise HTTPException(status_code=404, detail="Exam not found")

    result = await db.execute(
        select(ExamEnrollment).where(ExamEnrollment.exam_id == exam_id)
    )
    enrollments = result.scalars().all()

    total = len(enrollments)
    not_started = sum(1 for e in enrollments if e.status == "pending")
    active = sum(1 for e in enrollments if e.status == "active")
    completed = sum(1 for e in enrollments if e.status == "completed")

    cutoff = datetime.now(timezone.utc).timestamp() - 300
    alerts_result = await db.execute(
        select(func.count(RawBehaviorEvent.id))
        .where(
            RawBehaviorEvent.exam_id == exam_id,
            RawBehaviorEvent.server_timestamp >= cutoff,
        )
    )
    recent_alerts = alerts_result.scalar() or 0

    return {
        "total_enrolled": total,
        "not_started": not_started,
        "active": active,
        "completed": completed,
        "recent_alerts_5min": recent_alerts,
    }


@router.get("/suspicious")
async def get_suspicious_students(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(RiskReport)
        .where(
            RiskReport.risk_level.in_(["high", "critical", "medium", "low"]),
            RiskReport.institution_id == current_user.institution_id,
        )
        .order_by(desc(RiskReport.overall_score))
        .limit(20)
    )
    reports = result.scalars().all()

    suspicious = []
    for report in reports:
        student = await db.get(User, report.student_id)
        exam = await db.get(Exam, report.exam_id)
        suspicious.append({
            "id": str(report.id),
            "student_id": str(report.student_id),
            "student_name": student.full_name if student else "Unknown",
            "exam_id": str(report.exam_id),
            "exam_title": exam.title if exam else "Unknown",
            "risk_score": report.overall_score,
            "risk_level": report.risk_level,
            "reviewed": report.reviewed_by is not None,
            "generated_at": report.generated_at.isoformat() if report.generated_at else None,
        })

    return suspicious
