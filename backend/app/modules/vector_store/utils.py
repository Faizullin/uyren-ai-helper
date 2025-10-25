"""Utility functions for vector store operations."""

import hashlib
import json
import re
from typing import Any

from app.modules.vector_store.models import DocumentChunk, VectorStoreConfig


def calculate_content_hash(content: str) -> str:
    """Calculate SHA-256 hash of content for deduplication."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def estimate_token_count(text: str) -> int:
    """Estimate token count for text (rough approximation)."""
    # Simple estimation: ~4 characters per token for English text
    # This is a rough approximation and should be replaced with proper tokenization
    return len(text) // 4


def chunk_text(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200,
    separators: list[str] | None = None,
) -> list[str]:
    """Split text into overlapping chunks."""

    if separators is None:
        separators = ["\n\n", "\n", ". ", "! ", "? ", " ", ""]

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + chunk_size, len(text))

        # Try to break at a separator
        if end < len(text):
            chunk_text_part = text[start:end]
            best_break = -1

            for separator in separators:
                if separator:
                    last_separator = chunk_text_part.rfind(separator)
                    if last_separator > best_break:
                        best_break = last_separator

            if best_break > 0:
                end = (
                    start
                    + best_break
                    + len(
                        separators[
                            separators.index(
                                text[
                                    start + best_break : start
                                    + best_break
                                    + len(separators[0])
                                ]
                            )
                        ]
                    )
                )

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        start = end - chunk_overlap

        if start >= len(text):
            break

    return chunks


def clean_text(text: str) -> str:
    """Clean and normalize text content."""
    # Remove excessive whitespace
    text = re.sub(r"\s+", " ", text)

    # Remove control characters except newlines and tabs
    text = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]", "", text)

    # Normalize line endings
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    return text.strip()


def extract_metadata_from_content(content: str) -> dict[str, Any]:
    """Extract metadata from content (placeholder implementation)."""

    metadata = {
        "content_length": len(content),
        "word_count": len(content.split()),
        "line_count": content.count("\n") + 1,
        "has_code": bool(re.search(r"```|`[^`]+`", content)),
        "has_urls": bool(re.search(r"https?://\S+", content)),
        "has_emails": bool(
            re.search(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", content)
        ),
    }

    return metadata


def validate_supabase_vector_config(config: dict[str, Any]) -> bool:
    """Validate Supabase vector store configuration."""

    required_fields = [
        "table_name",
        "vector_dimension",
        "index_type",
        "metric",
        "lists",
    ]

    for field in required_fields:
        if field not in config or not config[field]:
            return False

    # Validate vector dimension
    if (
        not isinstance(config["vector_dimension"], int)
        or config["vector_dimension"] <= 0
    ):
        return False

    # Validate metric
    if config["metric"] not in ["cosine", "euclidean", "inner_product"]:
        return False

    return True


def serialize_config(config: VectorStoreConfig) -> str:
    """Serialize vector store configuration to JSON string."""
    return json.dumps(config.model_dump(), default=str)


def deserialize_config(config_json: str) -> VectorStoreConfig:
    """Deserialize vector store configuration from JSON string."""
    config_dict = json.loads(config_json)
    return VectorStoreConfig(**config_dict)


def format_search_result(
    chunk: DocumentChunk,
    score: float,
    document_title: str | None = None,
) -> dict[str, Any]:
    """Format search result for API response."""

    result = {
        "chunk_id": str(chunk.id),
        "document_id": str(chunk.document_id),
        "content": chunk.content,
        "score": score,
        "metadata": {
            "chunk_index": chunk.chunk_index,
            "chunk_size": chunk.chunk_size,
            "embedding_model": chunk.embedding_model,
            "token_count": chunk.token_count,
            "created_at": chunk.created_at.isoformat() if chunk.created_at else None,
        },
    }

    if document_title:
        result["metadata"]["document_title"] = document_title

    return result


def get_embedding_dimension(model: str) -> int:
    """Get embedding dimension for a specific model."""

    model_dimensions = {
        "text-embedding-ada-002": 1536,
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "sentence-transformers/all-MiniLM-L6-v2": 384,
        "sentence-transformers/all-mpnet-base-v2": 768,
        "embed-english-v3.0": 1024,
        "embed-multilingual-v3.0": 1024,
    }

    return model_dimensions.get(model, 1536)


def calculate_embedding_cost(
    token_count: int,
    model: str = "text-embedding-3-small",
    operation: str = "input",
) -> float:
    """Calculate embedding cost based on token count and model."""

    # Pricing per 1M tokens (as of 2024)
    pricing = {
        "text-embedding-ada-002": {"input": 0.0001},
        "text-embedding-3-small": {"input": 0.00002},
        "text-embedding-3-large": {"input": 0.00013},
    }

    model_pricing = pricing.get(model, {"input": 0.00002})
    cost_per_token = model_pricing.get(operation, 0.00002) / 1_000_000

    return token_count * cost_per_token


def validate_chunk_size(chunk_size: int) -> bool:
    """Validate chunk size is within reasonable limits."""
    return 100 <= chunk_size <= 10000


def validate_chunk_overlap(chunk_overlap: int, chunk_size: int) -> bool:
    """Validate chunk overlap is reasonable relative to chunk size."""
    return 0 <= chunk_overlap < chunk_size // 2


def get_supabase_display_name() -> str:
    """Get display name for Supabase vector store."""
    return "Supabase Vector Store"


def get_model_display_name(model: str) -> str:
    """Get display name for embedding model."""

    display_names = {
        "text-embedding-ada-002": "OpenAI Ada 002",
        "text-embedding-3-small": "OpenAI 3 Small",
        "text-embedding-3-large": "OpenAI 3 Large",
        "sentence-transformers/all-MiniLM-L6-v2": "MiniLM L6 v2",
        "sentence-transformers/all-mpnet-base-v2": "MPNet Base v2",
        "embed-english-v3.0": "Cohere English v3",
        "embed-multilingual-v3.0": "Cohere Multilingual v3",
    }

    return display_names.get(model, model)


def generate_supabase_vector_function(
    table_name: str,
    vector_dimension: int,
    similarity_threshold: float = 0.7,
    match_count: int = 10,
) -> str:
    """Generate Supabase pgvector similarity search function."""

    return f"""
CREATE OR REPLACE FUNCTION match_{table_name} (
    query_embedding VECTOR({vector_dimension}),
    match_threshold FLOAT DEFAULT {similarity_threshold},
    match_count INT DEFAULT {match_count}
) RETURNS TABLE (
    id UUID,
    content TEXT,
    similarity FLOAT
) LANGUAGE SQL STABLE AS $$
SELECT
    id,
    content,
    1 - (embedding <=> query_embedding) AS similarity
FROM {table_name}
WHERE 1 - (embedding <=> query_embedding) > match_threshold
ORDER BY (embedding <=> query_embedding) ASC
LIMIT match_count;
$$;
"""


def create_supabase_vector_index(
    table_name: str,
    index_type: str = "ivfflat",
    lists: int = 100,
) -> str:
    """Generate Supabase pgvector index creation SQL."""

    return f"""
CREATE INDEX IF NOT EXISTS {table_name}_embedding_idx
ON {table_name}
USING {index_type} (embedding vector_cosine_ops)
WITH (lists = {lists});
"""


def format_supabase_vector_result(
    result: dict[str, Any],
    chunk_id: str | None = None,
    document_id: str | None = None,
) -> dict[str, Any]:
    """Format Supabase vector search result."""

    return {
        "id": result.get("id"),
        "content": result.get("content"),
        "similarity": result.get("similarity"),
        "chunk_id": chunk_id,
        "document_id": document_id,
    }
