"""Agent Run database models."""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import JSON, Column, Field, SQLModel

from app.models.enums import AgentRunStatus


class AgentRun(SQLModel, table=True):
    """Database ORM model for agent_runs table."""

    __tablename__ = "agent_runs"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    thread_id: uuid.UUID = Field(foreign_key="thread.id", ondelete="CASCADE")
    agent_id: uuid.UUID | None = Field(default=None, foreign_key="agents.id")
    agent_version_id: uuid.UUID | None = Field(
        default=None, foreign_key="agent_versions.id"
    )
    status: str = Field(default=AgentRunStatus.RUNNING)
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: datetime | None = None
    error_message: str | None = None
    my_metadata: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class AgentRunPublic(SQLModel):
    """Public agent run model."""

    id: uuid.UUID
    thread_id: uuid.UUID
    agent_id: uuid.UUID
    agent_version_id: uuid.UUID | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    error_message: str | None
    my_metadata: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class AgentRunsPublic(SQLModel):
    """Public agent runs list model."""

    data: list[AgentRunPublic]
    count: int


__all__ = ["AgentRun", "AgentRunPublic", "AgentRunsPublic"]
