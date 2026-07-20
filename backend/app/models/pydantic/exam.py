from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class QuestionCreate(BaseModel):
    question_type: str = "multiple_choice"
    text: str
    options: Optional[dict] = None
    correct_answer: Optional[str] = None
    correct_answers: Optional[list] = None
    marks: float = 1.0
    difficulty: str = "medium"
    order_index: int = 0
    explanation: Optional[str] = None
    time_limit_seconds: Optional[int] = None


class CourseCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    department: Optional[str] = None
    credits: Optional[int] = None
    institution_id: Optional[UUID] = None


class ExamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    course_id: UUID
    duration_minutes: int = 60
    total_marks: float = 0.0
    passing_marks: float = 0.0
    difficulty_level: str = "medium"
    instructions: Optional[str] = None
    require_fullscreen: bool = True
    allow_navigation: bool = True
    shuffle_questions: bool = False
    max_attempts: int = 1
    questions: list[QuestionCreate] = []


class EnrollStudent(BaseModel):
    student_id: UUID


class BulkEnrollStudents(BaseModel):
    student_ids: list[UUID]


class ExamResponse(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    status: str
    duration_minutes: int
    total_marks: float
    difficulty_level: str
    course_id: str
    question_count: int
    student_count: int
    created_at: Optional[str] = None
