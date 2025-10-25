"""Vector Store Pydantic schemas."""

import uuid
from datetime import datetime

from sqlmodel import SQLModel


class VectorStoreCreate(SQLModel):
    """Vector store creation schema."""

    name: str
    description: str | None = None


class VectorStoreUpdate(SQLModel):
    """Vector store update schema."""

    name: str | None = None
    description: str | None = None
    status: str | None = None


class VectorStorePublic(SQLModel):
    """Public vector store schema for API responses."""

    id: uuid.UUID
    owner_id: uuid.UUID
    project_id: uuid.UUID | None
    name: str
    description: str | None
    provider: str
    config: str
    status: str
    is_public: bool
    document_count: int
    chunk_count: int
    total_tokens: int
    created_at: datetime
    updated_at: datetime
    last_used_at: datetime | None


class DocumentCreate(SQLModel):
    """Document creation schema - references knowledge base entry."""

    knowledge_base_entry_id: uuid.UUID
    target_type: str | None = None
    target_id: uuid.UUID | None = None


class DocumentUpdate(SQLModel):
    """Document update schema."""

    target_type: str | None = None
    target_id: uuid.UUID | None = None


class DocumentPublic(SQLModel):
    """Public document schema for API responses."""

    id: uuid.UUID
    vector_store_id: uuid.UUID
    owner_id: uuid.UUID
    knowledge_base_entry_id: uuid.UUID
    target_type: str | None
    target_id: uuid.UUID | None
    chunk_count: int
    total_tokens: int
    processing_status: str
    created_at: datetime
    updated_at: datetime
    processed_at: datetime | None
