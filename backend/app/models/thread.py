"""Thread database models."""

import uuid
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:
    from app.models.user import User


class ThreadBase(SQLModel):
    """Base thread model."""

    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=1000)


class Thread(ThreadBase, table=True):
    """Thread database model."""

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    project_id: uuid.UUID | None = Field(
        default=None, foreign_key="projects.id", ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationships
    owner: "User" = Relationship()  # type: ignore
    messages: list["ThreadMessage"] = Relationship(
        back_populates="thread", cascade_delete=True
    )  # type: ignore


class ThreadMessageBase(SQLModel):
    """Base thread message model."""

    content: str = Field(min_length=1, max_length=10000)
    role: str = Field(
        default="user", max_length=50
    )  # e.g., "user", "assistant", "system"


class ThreadMessage(ThreadMessageBase, table=True):
    """Thread message database model."""

    __tablename__ = "thread_message"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    thread_id: uuid.UUID = Field(
        foreign_key="thread.id", nullable=False, ondelete="CASCADE"
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Relationship
    thread: "Thread" = Relationship(back_populates="messages")  # type: ignore


__all__ = [
    "Thread",
    "ThreadBase",
    "ThreadMessage",
    "ThreadMessageBase",
]
