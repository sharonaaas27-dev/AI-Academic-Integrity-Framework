from abc import ABC, abstractmethod
from typing import Generic, TypeVar, Optional
from uuid import UUID

T = TypeVar("T")


class IRepository(ABC, Generic[T]):
    """Generic repository interface."""

    @abstractmethod
    async def get(self, id: UUID) -> Optional[T]:
        """Get entity by ID."""
        pass

    @abstractmethod
    async def get_all(
        self, skip: int = 0, limit: int = 100
    ) -> list[T]:
        """Get all entities with pagination."""
        pass

    @abstractmethod
    async def add(self, entity: T) -> T:
        """Add a new entity."""
        pass

    @abstractmethod
    async def update(self, entity: T) -> T:
        """Update an existing entity."""
        pass

    @abstractmethod
    async def delete(self, id: UUID) -> None:
        """Soft delete an entity."""
        pass

    @abstractmethod
    async def count(self) -> int:
        """Get total count of entities."""
        pass


class IUserRepository(IRepository):
    @abstractmethod
    async def get_by_email(self, email: str) -> Optional[T]:
        pass

    @abstractmethod
    async def get_by_institution(
        self, institution_id: UUID, role: Optional[str] = None
    ) -> list[T]:
        pass


class IExamRepository(IRepository):
    @abstractmethod
    async def get_by_institution(self, institution_id: UUID) -> list[T]:
        pass

    @abstractmethod
    async def get_active_exams(self) -> list[T]:
        pass


class IBehaviorEventRepository(IRepository):
    @abstractmethod
    async def get_by_exam_and_student(
        self, exam_id: UUID, student_id: UUID
    ) -> list[T]:
        pass

    @abstractmethod
    async def get_unprocessed_events(self, limit: int = 100) -> list[T]:
        pass


class IRiskReportRepository(IRepository):
    @abstractmethod
    async def get_by_exam(self, exam_id: UUID) -> list[T]:
        pass

    @abstractmethod
    async def get_high_risk(
        self, threshold: float = 60.0
    ) -> list[T]:
        pass
