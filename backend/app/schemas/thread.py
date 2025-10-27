"""Thread Pydantic schemas."""

import uuid
from datetime import datetime

from sqlmodel import SQLModel


class ThreadCreate(SQLModel):
    """Thread creation schema."""

    title: str
    description: str | None = None
    target_type: str | None = None


class ThreadUpdate(SQLModel):
    """Thread update schema."""

    title: str | None = None
    description: str | None = None
    target_type: str | None = None


class ThreadPublic(SQLModel):
    """Public thread schema for API responses."""

    id: uuid.UUID
    title: str
    description: str | None
    target_type: str | None
    owner_id: uuid.UUID
    project_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ThreadDetail(SQLModel):
    """Detailed thread schema with full information."""

    id: uuid.UUID
    title: str
    description: str | None
    target_type: str | None
    owner_id: uuid.UUID
    project_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class ThreadMessageCreate(SQLModel):
    """Thread message creation schema."""

    content: str
    role: str = "user"
    data: dict | None = None


class ThreadMessageUpdate(SQLModel):
    """Thread message update schema."""

    content: str | None = None
    data: dict | None = None


class ThreadMessagePublic(SQLModel):
    """Public thread message schema for API responses."""

    id: uuid.UUID
    thread_id: uuid.UUID
    content: str
    role: str
    data: dict | None = None
    created_at: datetime
    updated_at: datetime
