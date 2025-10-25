"""Vector Store data models."""

import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field
from sqlmodel import Column, SQLModel, Text


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


class VectorStoreConfig(BaseModel):
    """Configuration for vector store providers."""

    provider: VectorStoreProvider
    name: str
    description: str | None = None

    # Provider-specific configuration
    config: dict[str, Any] = Field(default_factory=dict)

    # Embedding configuration
    embedding_model: EmbeddingModel = EmbeddingModel.OPENAI_3_SMALL
    embedding_dimension: int = 1536  # Default for OpenAI ada-002

    # Index configuration
    index_name: str | None = None
    namespace: str | None = None

    # Performance settings
    batch_size: int = 100
    max_retries: int = 3
    timeout: int = 30

    class Config:
        use_enum_values = True


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
    last_used_at: datetime | None = None


class Document(SQLModel, table=True):
    """Document database model for vector store - references knowledge base entries."""

    __tablename__ = "documents"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    vector_store_id: uuid.UUID = Field(
        foreign_key="vector_stores.id", nullable=False, ondelete="CASCADE", index=True
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )

    # Reference to knowledge base entry
    knowledge_base_entry_id: uuid.UUID = Field(
        foreign_key="knowledge_base_entries.id", nullable=False, ondelete="CASCADE", index=True
    )

    # Target reference for flexible integration (can be null)
    target_type: str | None = Field(default=None, max_length=50, index=True)  # "course", "lesson", etc.
    target_id: uuid.UUID | None = Field(default=None, index=True)  # ID of the target entity

    # Processing metadata
    chunk_count: int = Field(default=0)
    total_tokens: int = Field(default=0)
    processing_status: str = Field(
        default="pending", max_length=20
    )  # pending, processing, completed, error

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    processed_at: datetime | None = None


class DocumentChunk(SQLModel, table=True):
    """Document chunk database model for vector embeddings."""

    __tablename__ = "document_chunks"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    document_id: uuid.UUID = Field(
        foreign_key="documents.id", nullable=False, ondelete="CASCADE", index=True
    )
    vector_store_id: uuid.UUID = Field(
        foreign_key="vector_stores.id", nullable=False, ondelete="CASCADE", index=True
    )

    # Chunk content
    content: str = Field(sa_column=Column(Text))
    chunk_index: int = Field(index=True)  # Order within document
    chunk_size: int = Field(default=0)  # Character count

    # Embedding metadata
    embedding_model: str = Field(max_length=100, index=True)
    embedding_dimension: int = Field(default=1536)
    token_count: int = Field(default=0)

    # Vector store metadata
    vector_id: str | None = Field(
        default=None, max_length=255, index=True
    )  # Provider-specific ID
    metadata: str | None = Field(default=None, sa_column=Column(Text))  # JSON string

    # Status
    status: str = Field(default="pending", max_length=20)  # pending, embedded, error

    # Timestamps
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    embedded_at: datetime | None = None


class Embedding(BaseModel):
    """Embedding data model."""

    vector_id: str
    vector: list[float]
    metadata: dict[str, Any] = Field(default_factory=dict)

    # Optional fields for tracking
    document_id: uuid.UUID | None = None
    chunk_id: uuid.UUID | None = None
    embedding_model: str | None = None
    token_count: int | None = None


class SearchResult(BaseModel):
    """Search result model."""

    vector_id: str
    content: str
    score: float
    metadata: dict[str, Any] = Field(default_factory=dict)

    # Optional fields
    document_id: uuid.UUID | None = None
    chunk_id: uuid.UUID | None = None
    document_title: str | None = None


class VectorStoreStats(BaseModel):
    """Vector store statistics model."""

    vector_store_id: uuid.UUID
    document_count: int = 0
    chunk_count: int = 0
    total_tokens: int = 0
    storage_size_bytes: int = 0
    last_updated: datetime | None = None
