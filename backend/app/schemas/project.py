"""Project Pydantic schemas."""

import uuid
from datetime import datetime

from sqlmodel import SQLModel


class ProjectCreate(SQLModel):
    """Project creation schema."""

    name: str
    description: str | None = None
    is_public: bool = False


class ProjectUpdate(SQLModel):
    """Project update schema."""

    name: str | None = None
    description: str | None = None
    is_public: bool | None = None


class ProjectPublic(SQLModel):
    """Public project response schema."""

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    description: str | None
    is_public: bool
    created_at: datetime
    updated_at: datetime

