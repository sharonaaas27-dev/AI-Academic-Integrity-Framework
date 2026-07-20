from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
from typing import Optional
from uuid import UUID

from ....core.database import get_db
from ....core.security import hash_password
from ....api.deps import get_current_user, require_role
from ....domain.enums import UserRole
from ....models.sqlalchemy.user import User
from ....models.sqlalchemy.institution import Institution
from ....models.sqlalchemy.exam import Exam, ExamEnrollment
from ....models.sqlalchemy.risk import RiskReport, Rule
from ....models.sqlalchemy.behavior import RawBehaviorEvent
from ....models.pydantic.admin import (
    DashboardStats,
    SystemHealthResponse,
    CreateUserRequest,
    UpdateRuleRequest,
    RiskOverviewResponse,
)

router = APIRouter()


@router.get("/dashboard", response_model=DashboardStats)
async def admin_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    # Total counts
    total_exams = await db.scalar(select(func.count(Exam.id)))
    total_students = await db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.STUDENT)
    )
    total_institutions = await db.scalar(select(func.count(Institution.id)))

    # Active exams
    active_exams = await db.scalar(
        select(func.count(Exam.id)).where(Exam.status == "active")
    )

    # High risk reports
    high_risk = await db.scalar(
        select(func.count(RiskReport.id)).where(
            RiskReport.risk_level.in_(["high", "critical"])
        )
    )

    # Recent events
    recent_events = await db.scalar(
        select(func.count(RawBehaviorEvent.id)).where(
            RawBehaviorEvent.server_timestamp
            > (func.extract("epoch", func.now()) - 3600)
        )
    )

    return DashboardStats(
        total_exams=total_exams or 0,
        total_students=total_students or 0,
        total_institutions=total_institutions or 0,
        active_exams=active_exams or 0,
        high_risk_reports=high_risk or 0,
        recent_events_per_hour=recent_events or 0,
    )


@router.get("/exams")
async def list_exams(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    query = select(Exam)
    if status:
        query = query.where(Exam.status == status)
    query = query.order_by(desc(Exam.created_at)).offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    exams = result.scalars().all()

    total = await db.scalar(select(func.count(Exam.id)))
    if status:
        total = await db.scalar(
            select(func.count(Exam.id)).where(Exam.status == status)
        )

    return {
        "exams": [
            {
                "id": str(e.id),
                "title": e.title,
                "course_name": e.course.name if e.course else None,
                "teacher_name": e.creator.full_name if e.creator else None,
                "status": e.status.value if hasattr(e.status, 'value') else e.status,
                "duration_minutes": e.duration_minutes,
                "total_students": len(e.enrollments) if hasattr(e, 'enrollments') else 0,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in exams
        ],
        "total": total or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/risk-overview", response_model=RiskOverviewResponse)
async def risk_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    # Risk level distribution
    risk_counts = await db.execute(
        select(RiskReport.risk_level, func.count(RiskReport.id))
        .group_by(RiskReport.risk_level)
    )
    distribution = {row[0]: row[1] for row in risk_counts}

    # Recently flagged
    recent_result = await db.execute(
        select(RiskReport)
        .order_by(desc(RiskReport.generated_at))
        .limit(10)
    )
    recent = recent_result.scalars().all()

    return RiskOverviewResponse(
        distribution=distribution,
        total_reports=sum(distribution.values()),
        recent_flags=[
            {
                "id": str(r.id),
                "exam_id": str(r.exam_id),
                "student_id": str(r.student_id),
                "score": r.overall_score,
                "level": r.risk_level,
                "generated_at": r.generated_at.isoformat(),
            }
            for r in recent
        ],
    )


@router.get("/rules")
async def list_rules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    result = await db.execute(
        select(Rule).where(Rule.is_active == True).order_by(Rule.priority.desc())
    )
    rules = result.scalars().all()

    return {
        "rules": [
            {
                "id": str(r.id),
                "name": r.name,
                "description": r.description,
                "condition": r.condition,
                "score_increment": r.score_increment,
                "category": r.category,
                "priority": r.priority,
                "is_active": r.is_active,
            }
            for r in rules
        ],
        "total": len(rules),
    }


@router.put("/rules/{rule_id}")
async def update_rule(
    rule_id: UUID,
    request: UpdateRuleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()

    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    if request.name is not None:
        rule.name = request.name
    if request.score_increment is not None:
        rule.score_increment = request.score_increment
    if request.is_active is not None:
        rule.is_active = request.is_active
    if request.priority is not None:
        rule.priority = request.priority
    if request.condition is not None:
        rule.condition = request.condition

    return {"message": "Rule updated successfully", "rule_id": str(rule.id)}


@router.get("/users")
async def list_users(
    q: str = Query("", min_length=0),
    role: Optional[str] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    query = select(User)
    if q:
        query = query.where(
            or_(
                User.first_name.ilike(f"%{q}%"),
                User.last_name.ilike(f"%{q}%"),
                User.email.ilike(f"%{q}%"),
            )
        )
    if role:
        query = query.where(User.role == role)
    query = query.order_by(User.created_at.desc()).offset((page - 1) * per_page).limit(per_page)

    result = await db.execute(query)
    users = result.scalars().all()

    total = await db.scalar(select(func.count(User.id)))

    return {
        "users": [
            {
                "id": str(u.id),
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "full_name": u.full_name,
                "role": u.role.value if hasattr(u.role, 'value') else u.role,
                "is_active": u.is_active,
                "is_verified": u.is_verified,
                "is_locked": u.is_locked,
                "institution_id": str(u.institution_id),
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "total": total or 0,
        "page": page,
        "per_page": per_page,
    }


@router.post("/users")
async def create_user(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    email = data.get("email", "")
    password = data.get("password", "changeme123")
    first_name = data.get("first_name", "")
    last_name = data.get("last_name", "")
    role_str = data.get("role", "student")
    institution_id = data.get("institution_id")

    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists")

    user = User(
        email=email,
        password_hash=hash_password(password),
        first_name=first_name,
        last_name=last_name,
        role=role_str,
        institution_id=UUID(institution_id) if institution_id else current_user.institution_id,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    return {
        "id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role.value if hasattr(user.role, 'value') else user.role,
        "message": "User created successfully",
    }


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if "is_active" in data:
        user.is_active = data["is_active"]
    if "is_locked" in data:
        user.is_locked = data["is_locked"]
    if "role" in data:
        user.role = data["role"]
    if "first_name" in data:
        user.first_name = data["first_name"]
    if "last_name" in data:
        user.last_name = data["last_name"]

    return {"message": "User updated successfully", "user_id": str(user.id)}


@router.get("/institutions")
async def list_institutions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    result = await db.execute(
        select(Institution).order_by(Institution.name)
    )
    institutions = result.scalars().all()

    return [
        {
            "id": str(inst.id),
            "name": inst.name,
            "slug": inst.slug,
            "domain": inst.domain,
            "is_active": inst.is_active,
            "subscription_tier": inst.subscription_tier,
        }
        for inst in institutions
    ]


@router.post("/institutions")
async def create_institution(
    data: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    inst = Institution(
        name=data["name"],
        slug=data.get("slug", ""),
        domain=data.get("domain", ""),
        is_active=True,
        subscription_tier=data.get("subscription_tier", "free"),
    )
    db.add(inst)
    await db.flush()

    return {
        "id": str(inst.id),
        "name": inst.name,
        "slug": inst.slug,
        "message": "Institution created successfully",
    }


@router.get("/system-health")
async def system_health(
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.SUPER_ADMIN])),
):
    """Returns system health information."""
    return SystemHealthResponse(
        status="healthy",
        version="1.0.0",
        uptime_seconds=0,
        active_connections=0,
        queue_size=0,
        memory_usage_mb=0,
    )
