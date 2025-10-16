"""Project database models."""

import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Project(SQLModel, table=True):
    """Database ORM model for projects table."""
    __tablename__ = "projects"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    name: str = Field(max_length=255)
    description: str | None = Field(default=None, max_length=1000)
    is_public: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ProjectPublic(SQLModel):
    """Public project model."""

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    description: str | None
    is_public: bool
    created_at: datetime
    updated_at: datetime


class ProjectsPublic(SQLModel):
    """Public projects list model."""

    data: list[ProjectPublic]
    count: int


__all__ = ["Project", "ProjectPublic", "ProjectsPublic"]

