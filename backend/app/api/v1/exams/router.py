from fastapi import APIRouter, Depends, HTTPException, Query, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime, timezone

from ....core.database import get_db, async_session_factory
from ....api.deps import get_current_user, require_role
from ....domain.enums import UserRole, ExamStatus, QuestionType
from ....models.sqlalchemy.exam import Exam, Question, ExamEnrollment, Answer, Course
from ....models.sqlalchemy.user import User
from ....models.sqlalchemy.behavior import RawBehaviorEvent
from ....models.sqlalchemy.risk import RiskReport
from ....models.pydantic.exam import ExamCreate, QuestionCreate, EnrollStudent, BulkEnrollStudents
from ....services.risk.risk_engine import risk_engine
from ....services.feature_engineering.feature_engine import feature_engine
from ....services.explainable_ai.explainer import explainer
from ....services.timeline.timeline_engine import timeline_engine

router = APIRouter()


@router.get("/{exam_id}")
async def get_exam(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Exam).where(Exam.id == exam_id, Exam.is_deleted == False)
    )
    exam = result.scalar_one_or_none()

    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    is_student = current_user.role == UserRole.STUDENT
    if is_student:
        if exam.status not in [ExamStatus.ACTIVE, ExamStatus.SCHEDULED]:
            raise HTTPException(status_code=403, detail="Exam is not available")
        enrollment = await db.execute(
            select(ExamEnrollment).where(
                ExamEnrollment.exam_id == exam_id,
                ExamEnrollment.student_id == current_user.id,
            )
        )
        if not enrollment.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="You are not enrolled in this exam")

    questions_result = await db.execute(
        select(Question)
        .where(Question.exam_id == exam_id, Question.is_deleted == False)
        .order_by(Question.order_index)
    )
    questions = questions_result.scalars().all()

    return {
        "id": str(exam.id),
        "title": exam.title,
        "description": exam.description,
        "status": exam.status.value if hasattr(exam.status, 'value') else exam.status,
        "duration_minutes": exam.duration_minutes,
        "start_time": exam.start_time.isoformat() if exam.start_time else None,
        "end_time": exam.end_time.isoformat() if exam.end_time else None,
        "total_marks": exam.total_marks,
        "passing_marks": exam.passing_marks,
        "shuffle_questions": exam.shuffle_questions,
        "difficulty_level": exam.difficulty_level,
        "instructions": exam.instructions,
        "require_fullscreen": exam.require_fullscreen,
        "questions": [
            {
                "id": str(q.id),
                "question_type": q.question_type.value if hasattr(q.question_type, 'value') else q.question_type,
                "text": q.text,
                "options": q.options,
                "marks": q.marks,
                "difficulty": q.difficulty,
                "order_index": q.order_index,
            }
            for q in questions
        ],
    }


@router.post("/{exam_id}/start")
async def start_exam(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enrollment_result = await db.execute(
        select(ExamEnrollment).where(
            ExamEnrollment.exam_id == exam_id,
            ExamEnrollment.student_id == current_user.id,
        )
    )
    enrollment = enrollment_result.scalar_one_or_none()

    if not enrollment:
        enrollment = ExamEnrollment(
            exam_id=exam_id,
            student_id=current_user.id,
            institution_id=current_user.institution_id,
            status="active",
            started_at=datetime.now(timezone.utc),
        )
        db.add(enrollment)
    else:
        if enrollment.status == "completed":
            raise HTTPException(status_code=400, detail="Exam already submitted")
        enrollment.status = "active"
        enrollment.started_at = datetime.now(timezone.utc)

    await db.flush()

    return {"status": "started", "started_at": enrollment.started_at.isoformat()}


@router.post("/{exam_id}/submit")
async def submit_exam(
    exam_id: UUID,
    data: dict,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enrollment_result = await db.execute(
        select(ExamEnrollment).where(
            ExamEnrollment.exam_id == exam_id,
            ExamEnrollment.student_id == current_user.id,
        )
    )
    enrollment = enrollment_result.scalar_one_or_none()

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    # Fetch all questions for grading
    questions_result = await db.execute(
        select(Question).where(
            Question.exam_id == exam_id,
            Question.is_deleted == False,
        )
    )
    questions = {str(q.id): q for q in questions_result.scalars().all()}

    answers_data = data.get("answers", {})
    total_marks = sum(q.marks for q in questions.values())
    obtained_marks = 0.0

    for question_id, answer_text in answers_data.items():
        q = questions.get(question_id)
        is_correct = None
        marks_obtained = 0.0

        if q:
            if q.correct_answer is not None:
                is_correct = str(answer_text).strip().lower() == str(q.correct_answer).strip().lower()
                marks_obtained = q.marks if is_correct else 0.0
            elif q.correct_answers:
                is_correct = str(answer_text).strip().lower() in [str(a).strip().lower() for a in q.correct_answers]
                marks_obtained = q.marks if is_correct else 0.0
            else:
                is_correct = None
                marks_obtained = None

        answer = Answer(
            enrollment_id=enrollment.id,
            question_id=UUID(question_id),
            answer_text=str(answer_text) if answer_text else None,
            is_correct=is_correct,
            marks_obtained=marks_obtained,
        )
        db.add(answer)

        if marks_obtained is not None:
            obtained_marks += marks_obtained

    # Update enrollment
    enrollment.submitted_at = func.now()
    enrollment.status = "completed"
    enrollment.time_taken_seconds = data.get("time_taken", 0)
    enrollment.score = obtained_marks
    enrollment.total_marks = total_marks
    enrollment.percentage = round((obtained_marks / total_marks * 100), 2) if total_marks > 0 else 0.0

    # Schedule risk score calculation in background
    background_tasks.add_task(
        calculate_risk_for_submission, exam_id, current_user.id,
        current_user.institution_id, enrollment.id
    )

    return {
        "message": "Exam submitted successfully",
        "enrollment_id": str(enrollment.id),
        "score": obtained_marks,
        "total_marks": total_marks,
        "percentage": enrollment.percentage,
    }


async def calculate_risk_for_submission(
    exam_id: UUID,
    student_id: UUID,
    institution_id: UUID,
    enrollment_id: UUID,
):
    """Background task: calculate and store risk score after exam submission."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        async with async_session_factory() as db:
            events_result = await db.execute(
                select(RawBehaviorEvent)
                .where(
                    RawBehaviorEvent.exam_id == exam_id,
                    RawBehaviorEvent.student_id == student_id,
                )
                .order_by(RawBehaviorEvent.client_timestamp)
            )
            raw_events = events_result.scalars().all()

            event_dicts = [
                {
                    "event_type": e.event_type,
                    "event_data": e.event_data,
                    "data": e.event_data,
                    "client_timestamp": e.client_timestamp,
                }
                for e in raw_events
            ]

            features = feature_engine.extract_features(event_dicts)

            enrollment = await db.get(ExamEnrollment, enrollment_id)
            exam_difficulty = enrollment.exam.difficulty_level if enrollment and enrollment.exam else "medium"

            risk_score = await risk_engine.calculate_risk(
                exam_id=exam_id,
                student_id=student_id,
                institution_id=institution_id,
                features=features,
                exam_difficulty=exam_difficulty,
            )

            timeline = timeline_engine.build_timeline(event_dicts)
            explanation = explainer.generate_explanation(risk_score, features, timeline)

            report = RiskReport(
                exam_id=exam_id,
                student_id=student_id,
                enrollment_id=enrollment_id,
                institution_id=institution_id,
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
                "Auto risk score calculated: student=%s exam=%s score=%.2f level=%s",
                student_id, exam_id, risk_score.overall_score, risk_score.risk_level.value,
            )
    except Exception as e:
        logger.error("Failed to auto-calculate risk score: %s", str(e), exc_info=True)


@router.post("")
async def create_exam(
    data: ExamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN, UserRole.EXAM_CONTROLLER])),
):
    course = await db.get(Course, data.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    exam = Exam(
        institution_id=current_user.institution_id,
        course_id=data.course_id,
        created_by=current_user.id,
        title=data.title,
        description=data.description,
        duration_minutes=data.duration_minutes,
        total_marks=data.total_marks,
        passing_marks=data.passing_marks,
        difficulty_level=data.difficulty_level,
        instructions=data.instructions,
        require_fullscreen=data.require_fullscreen,
        allow_navigation=data.allow_navigation,
        shuffle_questions=data.shuffle_questions,
        max_attempts=data.max_attempts,
    )
    db.add(exam)
    await db.flush()

    total_marks = 0.0
    for i, q_data in enumerate(data.questions):
        q = Question(
            exam_id=exam.id,
            question_type=q_data.question_type,
            text=q_data.text,
            options=q_data.options,
            correct_answer=q_data.correct_answer,
            correct_answers=q_data.correct_answers,
            marks=q_data.marks,
            difficulty=q_data.difficulty,
            order_index=q_data.order_index or i,
            explanation=q_data.explanation,
            time_limit_seconds=q_data.time_limit_seconds,
        )
        db.add(q)
        total_marks += q_data.marks

    exam.total_marks = total_marks or data.total_marks
    await db.flush()

    return {
        "id": str(exam.id),
        "title": exam.title,
        "status": exam.status.value if hasattr(exam.status, 'value') else exam.status,
        "duration_minutes": exam.duration_minutes,
        "total_marks": exam.total_marks,
        "question_count": len(data.questions),
        "message": "Exam created successfully",
    }


@router.post("/{exam_id}/enroll")
async def enroll_student(
    exam_id: UUID,
    data: EnrollStudent,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN, UserRole.EXAM_CONTROLLER])),
):
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    student = await db.get(User, data.student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    existing = await db.execute(
        select(ExamEnrollment).where(
            ExamEnrollment.exam_id == exam_id,
            ExamEnrollment.student_id == data.student_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Student already enrolled")

    enrollment = ExamEnrollment(
        exam_id=exam_id,
        student_id=data.student_id,
    )
    db.add(enrollment)
    await db.flush()

    return {
        "message": "Student enrolled successfully",
        "enrollment_id": str(enrollment.id),
    }


@router.post("/{exam_id}/publish")
async def publish_exam(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN, UserRole.EXAM_CONTROLLER])),
):
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    questions = await db.execute(
        select(Question).where(Question.exam_id == exam_id, Question.is_deleted == False)
    )
    if not questions.scalars().all():
        raise HTTPException(status_code=400, detail="Exam must have at least one question")

    exam.status = ExamStatus.ACTIVE
    await db.flush()

    return {"message": "Exam published successfully", "status": "active"}


@router.delete("/{exam_id}")
async def delete_exam(
    exam_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN, UserRole.EXAM_CONTROLLER])),
):
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    if exam.created_by != current_user.id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Not authorized to delete this exam")

    exam.is_deleted = True
    exam.deleted_at = datetime.now(timezone.utc)
    await db.flush()

    return {"message": "Exam deleted successfully"}


@router.delete("/{exam_id}/enroll/{student_id}")
async def unenroll_student(
    exam_id: UUID,
    student_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN, UserRole.EXAM_CONTROLLER])),
):
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    result = await db.execute(
        select(ExamEnrollment).where(
            ExamEnrollment.exam_id == exam_id,
            ExamEnrollment.student_id == student_id,
        )
    )
    enrollment = result.scalar_one_or_none()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    enrollment.is_deleted = True
    enrollment.deleted_at = datetime.now(timezone.utc)
    await db.flush()

    return {"message": "Student unenrolled successfully"}


@router.post("/{exam_id}/enroll/bulk")
async def bulk_enroll_students(
    exam_id: UUID,
    data: BulkEnrollStudents,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN, UserRole.EXAM_CONTROLLER])),
):
    exam = await db.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")

    enrolled = []
    skipped = []
    not_found = []

    for student_id in data.student_ids:
        student = await db.get(User, student_id)
        if not student:
            not_found.append(str(student_id))
            continue

        existing = await db.execute(
            select(ExamEnrollment).where(
                ExamEnrollment.exam_id == exam_id,
                ExamEnrollment.student_id == student_id,
            )
        )
        if existing.scalar_one_or_none():
            skipped.append(str(student_id))
            continue

        enrollment = ExamEnrollment(
            exam_id=exam_id,
            student_id=student_id,
        )
        db.add(enrollment)
        enrolled.append(str(student_id))

    await db.flush()

    return {
        "message": f"Enrolled {len(enrolled)} student(s)",
        "enrolled": enrolled,
        "skipped": skipped,
        "not_found": not_found,
    }
