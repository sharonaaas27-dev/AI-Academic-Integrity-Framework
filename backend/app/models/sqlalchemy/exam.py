import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String, Boolean, DateTime, ForeignKey, Text, Integer, Float,
    Enum as SAEnum, JSON
)
from sqlalchemy import Uuid as UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import Optional

from .base import Base, TimestampMixin, SoftDeleteMixin
from ...domain.enums import ExamStatus, QuestionType


class Course(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "courses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institutions.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    credits: Mapped[Optional[int]] = mapped_column(nullable=True)
    department: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    institution = relationship("Institution", back_populates="courses", lazy="selectin")
    exams = relationship("Exam", back_populates="course", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Course {self.code}: {self.name}>"


class Exam(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "exams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    institution_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("institutions.id"), nullable=False, index=True
    )
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False, index=True
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[ExamStatus] = mapped_column(
        SAEnum(ExamStatus), default=ExamStatus.DRAFT, nullable=False
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    total_marks: Mapped[float] = mapped_column(Float, default=0.0)
    passing_marks: Mapped[float] = mapped_column(Float, default=0.0)
    shuffle_questions: Mapped[bool] = mapped_column(Boolean, default=False)
    shuffle_options: Mapped[bool] = mapped_column(Boolean, default=False)
    show_result_immediately: Mapped[bool] = mapped_column(Boolean, default=False)
    max_attempts: Mapped[int] = mapped_column(Integer, default=1)
    require_fullscreen: Mapped[bool] = mapped_column(Boolean, default=True)
    require_webcam: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_navigation: Mapped[bool] = mapped_column(Boolean, default=True)
    random_question_selection: Mapped[bool] = mapped_column(Boolean, default=False)
    questions_per_student: Mapped[Optional[int]] = mapped_column(nullable=True)
    difficulty_level: Mapped[str] = mapped_column(String(20), default="medium")
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)

    institution = relationship("Institution", back_populates="exams", lazy="selectin")
    course = relationship("Course", back_populates="exams", lazy="selectin")
    creator = relationship("User", lazy="selectin")
    questions = relationship("Question", back_populates="exam", lazy="selectin", cascade="all, delete-orphan")
    enrollments = relationship("ExamEnrollment", back_populates="exam", lazy="selectin", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Exam {self.title} ({self.status.value})>"


class Question(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "questions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    exam_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exams.id"), nullable=False, index=True
    )
    question_type: Mapped[QuestionType] = mapped_column(
        SAEnum(QuestionType), nullable=False
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    options: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    correct_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    correct_answers: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    marks: Mapped[float] = mapped_column(Float, default=1.0)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    time_limit_seconds: Mapped[Optional[int]] = mapped_column(nullable=True)

    exam = relationship("Exam", back_populates="questions", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Question {self.id} ({self.question_type.value})>"


class ExamEnrollment(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "exam_enrollments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    exam_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exams.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(20), default="pending")
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    time_taken_seconds: Mapped[Optional[int]] = mapped_column(nullable=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    total_marks: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    percentage: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    device_info: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    browser_info: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True, default=dict)
    risk_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    risk_level: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_suspicious: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_by: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1)

    exam = relationship("Exam", back_populates="enrollments", lazy="selectin")
    student = relationship("User", back_populates="exam_enrollments", foreign_keys="ExamEnrollment.student_id", lazy="selectin")
    answers = relationship("Answer", back_populates="enrollment", lazy="selectin", cascade="all, delete-orphan")


class Answer(Base, TimestampMixin):
    __tablename__ = "answers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("exam_enrollments.id"), nullable=False, index=True
    )
    question_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False, index=True
    )
    answer_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    answer_choices: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)
    is_correct: Mapped[Optional[bool]] = mapped_column(nullable=True)
    marks_obtained: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    time_spent_seconds: Mapped[Optional[int]] = mapped_column(nullable=True)
    edit_count: Mapped[int] = mapped_column(Integer, default=0)
    answer_history: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    is_flagged: Mapped[bool] = mapped_column(Boolean, default=False)

    enrollment = relationship("ExamEnrollment", back_populates="answers", lazy="selectin")
