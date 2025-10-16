"""Agent database models."""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import JSON, Column, Field, SQLModel


class Agent(SQLModel, table=True):
    """Database ORM model for agents table."""

    __tablename__ = "agents"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    name: str
    description: str | None = None
    system_prompt: str
    configured_mcps: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    custom_mcps: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    agentpress_tools: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )
    is_default: bool = False
    is_public: bool = False
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    icon_name: str | None = None
    icon_color: str | None = None
    icon_background: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    current_version_id: uuid.UUID | None = Field(
        default=None, foreign_key="agent_versions.id"
    )
    version_count: int = 1
    my_metadata: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON))


class AgentVersion(SQLModel, table=True):
    """Database ORM model for agent_versions table."""

    __tablename__ = "agent_versions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_id: uuid.UUID = Field(foreign_key="agents.id")
    version_number: int
    version_name: str
    system_prompt: str
    model: str | None = None
    configured_mcps: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    custom_mcps: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    agentpress_tools: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )
    is_active: bool = True
    status: str = "active"
    config: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: uuid.UUID | None = None
    change_description: str | None = None
    previous_version_id: uuid.UUID | None = Field(
        default=None, foreign_key="agent_versions.id"
    )


class AgentTemplate(SQLModel, table=True):
    """Database ORM model for agent_templates table."""

    __tablename__ = "agent_templates"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    name: str
    description: str | None = None
    system_prompt: str
    mcp_requirements: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON)
    )
    agentpress_tools: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON)
    )
    tags: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    categories: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    is_public: bool = False
    marketplace_published_at: datetime | None = None
    download_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    icon_name: str | None = None
    icon_color: str | None = None
    icon_background: str | None = None
    my_metadata: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))


__all__ = ["Agent", "AgentVersion", "AgentTemplate"]
