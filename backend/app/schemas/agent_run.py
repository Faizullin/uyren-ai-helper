"""Agent Run Pydantic schemas."""

import uuid
from datetime import datetime
from typing import Any

from sqlmodel import SQLModel


class AgentRunCreate(SQLModel):
    """Agent run creation schema."""

    thread_id: uuid.UUID
    agent_id: uuid.UUID | None = None
    agent_version_id: uuid.UUID | None = None
    my_metadata: dict[str, Any] | None = None


class AgentRunUpdate(SQLModel):
    """Agent run update schema."""

    status: str | None = None
    error_message: str | None = None
    my_metadata: dict[str, Any] | None = None


class AgentRunPublic(SQLModel):
    """Public agent run schema for API responses."""

    id: uuid.UUID
    thread_id: uuid.UUID
    agent_id: uuid.UUID | None
    agent_version_id: uuid.UUID | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    error_message: str | None
    my_metadata: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class AgentRunDetail(SQLModel):
    """Detailed agent run schema with full information."""

    id: uuid.UUID
    thread_id: uuid.UUID
    agent_id: uuid.UUID | None
    agent_version_id: uuid.UUID | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    error_message: str | None
    my_metadata: dict[str, Any] | None
    created_at: datetime
    updated_at: datetime


class AgentStartRequest(SQLModel):
    """Request schema for starting an agent."""

    agent_id: str | None = None
    model_name: str | None = None
    my_metadata: dict[str, Any] | None = None


class AgentStartResponse(SQLModel):
    """Response schema for starting an agent."""

    agent_run_id: uuid.UUID
    thread_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    model_name: str | None = None
    agent_name: str | None = None
    status: str = "running"


class InitiateAgentResponse(SQLModel):
    """Response schema for initiating an agent session."""

    thread_id: uuid.UUID
    agent_run_id: uuid.UUID
    project_id: uuid.UUID | None = None
    model_name: str | None = None
    agent_name: str | None = None
    message: str = "Agent session initiated successfully"


class AgentRunStatusResponse(SQLModel):
    """Response schema for agent run status."""

    id: uuid.UUID
    thread_id: uuid.UUID
    agent_id: uuid.UUID | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    error_message: str | None
    my_metadata: dict[str, Any] | None


class AgentStopResponse(SQLModel):
    """Response schema for stopping an agent run."""

    message: str = "Agent run stopped successfully"


class AgentRetryResponse(SQLModel):
    """Response schema for retrying an agent run."""

    message: str = "Agent run retry initiated successfully"
