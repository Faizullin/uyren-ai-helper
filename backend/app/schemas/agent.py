"""Agent Pydantic schemas."""

import uuid
from datetime import datetime

from sqlmodel import SQLModel


class AgentCreate(SQLModel):
    """Agent creation schema."""

    name: str
    description: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    is_default: bool = False
    tags: list[str] | None = None
    icon_name: str | None = "bot"
    icon_color: str | None = "#000000"
    icon_background: str | None = "#F3F4F6"


class AgentUpdate(SQLModel):
    """Agent update schema."""

    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    is_default: bool | None = None
    is_public: bool | None = None
    tags: list[str] | None = None
    icon_name: str | None = None
    icon_color: str | None = None
    icon_background: str | None = None


class AgentPublic(SQLModel):
    """Public agent schema for API responses."""

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    description: str | None
    is_default: bool
    is_public: bool
    tags: list[str]
    icon_name: str | None
    icon_color: str | None
    icon_background: str | None
    version_count: int
    created_at: datetime
    updated_at: datetime


class AgentDetail(SQLModel):
    """Detailed agent schema with full configuration."""

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    description: str | None
    system_prompt: str | None
    model: str | None
    is_default: bool
    is_public: bool
    tags: list[str]
    icon_name: str | None
    icon_color: str | None
    icon_background: str | None
    configured_mcps: list[dict[str, str]]
    custom_mcps: list[dict[str, str]]
    agentpress_tools: dict[str, str]
    version_count: int
    current_version_id: uuid.UUID | None
    my_metadata: dict[str, str] | None
    created_at: datetime
    updated_at: datetime


class AgentIconGenerationRequest(SQLModel):
    """Request schema for agent icon generation."""

    name: str


class AgentIconGenerationResponse(SQLModel):
    """Response schema for agent icon generation."""

    icon_name: str
    icon_color: str
    icon_background: str
