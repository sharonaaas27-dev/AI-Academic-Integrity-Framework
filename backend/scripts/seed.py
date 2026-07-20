import asyncio
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import async_session_factory, engine, init_db
from app.core.security import hash_password
from app.domain.enums import UserRole
from app.models.sqlalchemy.institution import Institution
from app.models.sqlalchemy.user import User
from app.models.sqlalchemy.exam import Course


async def seed():
    await init_db()

    async with async_session_factory() as session:
        existing = await session.get(Institution, uuid.UUID("00000000-0000-0000-0000-000000000001"))
        if existing:
            print("Seed data already exists, skipping.")
            return

        inst = Institution(
            id=uuid.UUID("00000000-0000-0000-0000-000000000001"),
            name="Demo University",
            slug="demo-university",
            domain="demo.edu",
            is_active=True,
            subscription_tier="enterprise",
        )
        session.add(inst)

        admin = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000010"),
            institution_id=inst.id,
            email="admin@demo.edu",
            password_hash=hash_password("admin123"),
            first_name="Admin",
            last_name="User",
            role=UserRole.SUPER_ADMIN,
            is_active=True,
            is_verified=True,
        )
        session.add(admin)

        teacher = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000020"),
            institution_id=inst.id,
            email="teacher@demo.edu",
            password_hash=hash_password("teacher123"),
            first_name="Test",
            last_name="Teacher",
            role=UserRole.TEACHER,
            is_active=True,
            is_verified=True,
        )
        session.add(teacher)

        student = User(
            id=uuid.UUID("00000000-0000-0000-0000-000000000030"),
            institution_id=inst.id,
            email="student@demo.edu",
            password_hash=hash_password("student123"),
            first_name="Test",
            last_name="Student",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        session.add(student)

        course = Course(
            id=uuid.UUID("00000000-0000-0000-0000-000000000040"),
            institution_id=inst.id,
            name="Introduction to Computer Science",
            code="CS101",
            department="Computer Science",
            is_active=True,
        )
        session.add(course)

        await session.commit()
        print("Seed data created successfully!")
        print(f"  Institution: {inst.name} ({inst.slug})")
        print(f"  Admin: admin@demo.edu / admin123")
        print(f"  Teacher: teacher@demo.edu / teacher123")
        print(f"  Student: student@demo.edu / student123")


if __name__ == "__main__":
    asyncio.run(seed())
