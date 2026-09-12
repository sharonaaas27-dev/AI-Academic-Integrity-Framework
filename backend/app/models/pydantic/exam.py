from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class QuestionCreate(BaseModel):
    question_type: str = "multiple_choice"
    text: str = Field(..., min_length=1, max_length=10000)
    options: Optional[dict] = None
    correct_answer: Optional[str] = Field(default=None, max_length=10000)
    correct_answers: Optional[list] = None
    marks: float = Field(default=1.0, ge=0, le=10000)
    difficulty: str = Field(default="medium", pattern="^(easy|medium|hard)$")
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
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    course_id: UUID
    duration_minutes: int = Field(default=60, ge=1, le=1440)
    total_marks: float = Field(default=0.0, ge=0, le=100000)
    passing_marks: float = Field(default=0.0, ge=0, le=100000)
    difficulty_level: str = Field(default="medium", pattern="^(easy|medium|hard)$")
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
