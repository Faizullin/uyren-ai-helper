"""Knowledge Base models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Index, Text
from sqlmodel import Column, Field, SQLModel


class KnowledgeBaseFolder(SQLModel, table=True):
    """Database ORM model for knowledge_base_folders table."""

    __tablename__ = "knowledge_base_folders"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(foreign_key="user.id", ondelete="CASCADE")
    name: str = Field(max_length=255)
    description: str | None = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (Index("ix_kb_folders_owner_name", "owner_id", "name"),)


class KnowledgeBaseEntry(SQLModel, table=True):
    """Database ORM model for knowledge_base_entries table."""

    __tablename__ = "knowledge_base_entries"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    folder_id: uuid.UUID = Field(foreign_key="knowledge_base_folders.id", ondelete="CASCADE")
    owner_id: uuid.UUID = Field(foreign_key="user.id", ondelete="CASCADE")
    filename: str = Field(max_length=255)
    file_path: str
    file_size: int
    mime_type: str = Field(max_length=255)
    summary: str = Field(sa_column=Column(Text))
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_kb_entries_folder_active", "folder_id", "is_active"),
        Index("ix_kb_entries_owner_active", "owner_id", "is_active"),
    )


class AgentKnowledgeAssignment(SQLModel, table=True):
    """Database ORM model for agent_knowledge_assignments table."""

    __tablename__ = "agent_knowledge_assignments"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    agent_id: uuid.UUID = Field(foreign_key="agents.id", ondelete="CASCADE")
    entry_id: uuid.UUID = Field(foreign_key="knowledge_base_entries.id", ondelete="CASCADE")
    owner_id: uuid.UUID = Field(foreign_key="user.id", ondelete="CASCADE")
    enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_kb_assignments_agent_entry", "agent_id", "entry_id", unique=True),
        Index("ix_kb_assignments_agent_enabled", "agent_id", "enabled"),
    )
