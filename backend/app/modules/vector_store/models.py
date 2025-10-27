"""Vector Store data models."""

import uuid
from datetime import datetime, timezone
from enum import Enum

from pgvector.sqlalchemy import Vector
from sqlmodel import Column, Field, Relationship, SQLModel, Text


class VectorStoreProvider(str, Enum):
    """Supported vector store providers."""

    SUPABASE = "supabase"  # Supabase with pgvector


class EmbeddingModel(str, Enum):
    """Supported embedding models."""

    OPENAI_ADA_002 = "text-embedding-ada-002"
    OPENAI_3_SMALL = "text-embedding-3-small"
    OPENAI_3_LARGE = "text-embedding-3-large"
    HUGGINGFACE_ALL_MINILM_L6_V2 = "sentence-transformers/all-MiniLM-L6-v2"
    HUGGINGFACE_ALL_MPNET_BASE_V2 = "sentence-transformers/all-mpnet-base-v2"
    COHERE_EMBED_ENGLISH_V3 = "embed-english-v3.0"
    COHERE_EMBED_MULTILINGUAL_V3 = "embed-multilingual-v3.0"


class VectorStore(SQLModel, table=True):
    """Vector store database model."""

    __tablename__ = "vector_stores"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )
    project_id: uuid.UUID | None = Field(
        default=None, foreign_key="projects.id", ondelete="CASCADE", index=True
    )

    name: str = Field(max_length=255, index=True)
    description: str | None = Field(default=None, sa_column=Column(Text))

    # Vector store configuration
    provider: str = Field(max_length=50, index=True)  # VectorStoreProvider
    config: str = Field(sa_column=Column(Text))  # JSON string of VectorStoreConfig

    # Status and metadata
    status: str = Field(default="active", max_length=20)  # active, inactive, error
    is_public: bool = Field(default=False, index=True)

    # Statistics
    document_count: int = Field(default=0)
    chunk_count: int = Field(default=0)
    total_tokens: int = Field(default=0)

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Page(SQLModel, table=True):
    """Page model for storing documents/content with hierarchy."""

    __tablename__ = "page"
    __table_args__ = {"schema": "vector_store"}

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )
    vector_store_id: uuid.UUID = Field(
        foreign_key="vector_stores.id", nullable=False, ondelete="CASCADE", index=True
    )
    parent_page_id: uuid.UUID | None = Field(
        default=None, foreign_key="vector_store.page.id", ondelete="CASCADE", index=True
    )

    # Page content
    path: str = Field(max_length=500, unique=True, index=True)  # Unique path/URL
    checksum: str | None = Field(
        default=None, max_length=64
    )  # Content hash for change detection
    meta: str | None = Field(default=None, sa_column=Column(Text))  # JSON metadata

    # Target reference for flexible integration (course, lesson, etc.)
    target_type: str | None = Field(
        default=None, max_length=50, index=True
    )  # "course", "lesson", etc.
    target_id: uuid.UUID | None = Field(
        default=None, index=True
    )  # ID of the target entity

    source: str | None = Field(default=None, max_length=255)  # Source URL or file
    version: uuid.UUID | None = Field(default=None)  # Version tracking

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    last_refresh: datetime | None = None

    # Relationships
    sections: list["PageSection"] = Relationship(back_populates="page")


class PageSection(SQLModel, table=True):
    """Page section model with vector embeddings for semantic search."""

    __tablename__ = "page_section"
    __table_args__ = {"schema": "vector_store"}

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    page_id: uuid.UUID = Field(
        foreign_key="vector_store.page.id",
        nullable=False,
        ondelete="CASCADE",
        index=True,
    )

    # Section content
    content: str = Field(sa_column=Column(Text))
    token_count: int = Field(default=0)
    slug: str | None = Field(default=None, max_length=255)  # Section slug/anchor
    heading: str | None = Field(default=None, max_length=500)  # Section heading

    # Embedding vector
    embedding: list[float] | None = Field(default=None, sa_type=Vector(1536))

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    page: Page | None = Relationship(back_populates="sections")
