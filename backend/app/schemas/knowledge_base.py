"""Knowledge Base Pydantic schemas."""

import uuid
from datetime import datetime

from sqlmodel import SQLModel


class KnowledgeBaseFolderCreate(SQLModel):
    """Knowledge base folder creation schema."""

    name: str
    description: str | None = None


class KnowledgeBaseFolderUpdate(SQLModel):
    """Knowledge base folder update schema."""

    name: str | None = None
    description: str | None = None


class KnowledgeBaseFolderPublic(SQLModel):
    """Public knowledge base folder schema for API responses."""

    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    description: str | None
    entry_count: int = 0
    created_at: datetime
    updated_at: datetime


class KnowledgeBaseEntryUpdate(SQLModel):
    """Knowledge base entry update schema."""

    summary: str


class KnowledgeBaseEntryPublic(SQLModel):
    """Public knowledge base entry schema for API responses."""

    id: uuid.UUID
    folder_id: uuid.UUID
    owner_id: uuid.UUID
    filename: str
    file_size: int
    mime_type: str
    summary: str
    is_active: bool
    created_at: datetime
    updated_at: datetime


class KnowledgeBaseEntryWithFolder(SQLModel):
    """Knowledge base entry with folder information."""

    id: uuid.UUID
    folder_id: uuid.UUID
    owner_id: uuid.UUID
    filename: str
    file_size: int
    mime_type: str
    summary: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
    folder_name: str


class AgentKnowledgeAssignmentRequest(SQLModel):
    """Request to assign knowledge base entries to an agent."""

    entry_ids: list[uuid.UUID]


class AgentKnowledgeAssignmentPublic(SQLModel):
    """Public agent knowledge assignment schema for API responses."""

    id: uuid.UUID
    agent_id: uuid.UUID
    entry_id: uuid.UUID
    enabled: bool
    created_at: datetime


class FileUploadResponse(SQLModel):
    """File upload response schema."""

    success: bool
    entry_id: uuid.UUID
    filename: str
    summary: str
    file_size: int
    filename_changed: bool = False
    original_filename: str | None = None


class FileMoveRequest(SQLModel):
    """File move request schema."""

    target_folder_id: uuid.UUID


class KnowledgeBaseStats(SQLModel):
    """Knowledge base statistics schema."""

    total_folders: int
    total_entries: int
    total_size_bytes: int
    total_size_mb: float
    active_entries: int
