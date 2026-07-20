from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func
from typing import Optional
from uuid import UUID, uuid4

from ....core.database import get_db
from ....api.deps import get_current_user, require_role
from ....domain.enums import UserRole
from ....models.sqlalchemy.exam import Course
from ....models.sqlalchemy.user import User
from ....models.pydantic.exam import CourseCreate

router = APIRouter()


@router.post("")
async def create_course(
    data: CourseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.TEACHER, UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.EXAM_CONTROLLER])),
):
    institution_id = data.institution_id or current_user.institution_id
    if not institution_id:
        raise HTTPException(status_code=400, detail="Institution ID is required")
    if data.institution_id and current_user.role not in [UserRole.ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(status_code=403, detail="Only admins can specify institution_id")
    existing = await db.scalar(select(Course).where(Course.code == data.code, Course.is_deleted == False))
    if existing:
        raise HTTPException(status_code=409, detail="Course code already exists")

    course = Course(
        id=uuid4(),
        institution_id=institution_id,
        name=data.name,
        code=data.code,
        description=data.description,
        department=data.department,
        credits=data.credits,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return {
        "id": str(course.id),
        "name": course.name,
        "code": course.code,
        "department": course.department,
        "message": "Course created successfully",
    }


@router.get("")
async def list_courses(
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    institution_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Course).where(Course.is_deleted == False)
    if institution_id:
        query = query.where(Course.institution_id == institution_id)
    elif current_user.institution_id:
        query = query.where(Course.institution_id == current_user.institution_id)
    query = query.order_by(Course.name).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    courses = result.scalars().all()

    total_query = select(func.count(Course.id)).where(Course.is_deleted == False)
    if institution_id:
        total_query = total_query.where(Course.institution_id == institution_id)
    elif current_user.institution_id:
        total_query = total_query.where(Course.institution_id == current_user.institution_id)
    total = await db.scalar(total_query)

    return {
        "courses": [
            {
                "id": str(c.id),
                "name": c.name,
                "code": c.code,
                "description": c.description,
                "department": c.department,
                "credits": c.credits,
                "is_active": c.is_active,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in courses
        ],
        "total": total or 0,
        "page": page,
        "per_page": per_page,
    }
