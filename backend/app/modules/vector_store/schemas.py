"""Vector Store Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


# ==================== VectorStore Schemas ====================


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

    id: UUID
    owner_id: UUID
    project_id: UUID | None
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


# ==================== Page Schemas ====================


class PageCreate(SQLModel):
    """Page creation schema."""

    path: str
    content: str | None = None
    meta: dict | None = None
    target_type: str | None = None
    target_id: UUID | None = None
    source: str | None = None
    parent_page_id: UUID | None = None


class PageUpdate(SQLModel):
    """Page update schema."""

    path: str | None = None
    meta: dict | None = None
    target_type: str | None = None
    target_id: UUID | None = None
    source: str | None = None


class PagePublic(SQLModel):
    """Public page schema for API responses."""

    id: UUID
    owner_id: UUID
    vector_store_id: UUID
    parent_page_id: UUID | None
    path: str
    checksum: str | None
    meta: str | None
    target_type: str | None
    target_id: UUID | None
    source: str | None
    version: UUID | None
    created_at: datetime
    updated_at: datetime
    last_refresh: datetime | None


# ==================== PageSection Schemas ====================


class PageSectionCreate(SQLModel):
    """Page section creation schema."""

    content: str
    heading: str | None = None
    slug: str | None = None


class PageSectionUpdate(SQLModel):
    """Page section update schema."""

    content: str | None = None
    heading: str | None = None
    slug: str | None = None


class PageSectionPublic(SQLModel):
    """Public page section schema for API responses (excludes embedding vector)."""

    id: UUID
    page_id: UUID
    content: str
    token_count: int
    slug: str | None
    heading: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        # Exclude embedding field to avoid serialization issues
        fields = {"embedding": {"exclude": True}}


class PageSectionWithSimilarity(SQLModel):
    """Page section with similarity score for search results."""

    id: UUID
    page_id: UUID
    content: str
    heading: str | None
    slug: str | None
    similarity: float


class SearchRequest(SQLModel):
    """Search request schema."""

    query: str
    top_k: int = 5
    similarity_threshold: float = 0.7
    target_type: str | None = None
    target_id: UUID | None = None


class SearchResponse(SQLModel):
    """Search response schema."""

    query: str
    results: list[PageSectionWithSimilarity]
    results_count: int
    vector_store_id: UUID


# ==================== Bulk Operations ====================


class PageChunkRequest(SQLModel):
    """Request to chunk page content into sections."""

    content: str
    chunk_size: int = 1000
    chunk_overlap: int = 200


class PageChunkResponse(SQLModel):
    """Response after chunking page content."""

    page_id: UUID
    sections_created: int
    sections: list[PageSectionPublic]


