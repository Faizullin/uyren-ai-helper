"""Utility functions for vector store operations."""

import hashlib
import json
import re
from typing import Any

from app.modules.vector_store.models import PageSection


def calculate_content_hash(content: str) -> str:
    """Calculate SHA-256 hash of content for change detection."""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def estimate_token_count(text: str) -> int:
    """Estimate token count for text (rough approximation)."""
    # Simple estimation: ~4 characters per token for English text
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
                end = start + best_break + 1

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
    """Extract metadata from content."""
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


def extract_headings_from_markdown(content: str) -> list[dict[str, Any]]:
    """Extract headings from markdown content."""
    headings = []
    lines = content.split("\n")

    for i, line in enumerate(lines):
        # Match markdown headings (# Heading)
        match = re.match(r"^(#{1,6})\s+(.+)$", line.strip())
        if match:
            level = len(match.group(1))
            text = match.group(2).strip()
            slug = text.lower().replace(" ", "-")
            slug = re.sub(r"[^\w\-]", "", slug)

            headings.append({
                "level": level,
                "text": text,
                "slug": slug,
                "line": i,
            })

    return headings


def split_content_by_headings(content: str) -> list[dict[str, Any]]:
    """Split content into sections by markdown headings."""
    headings = extract_headings_from_markdown(content)
    lines = content.split("\n")
    sections = []

    for i, heading in enumerate(headings):
        start_line = heading["line"]
        end_line = headings[i + 1]["line"] if i + 1 < len(headings) else len(lines)

        section_content = "\n".join(lines[start_line:end_line]).strip()

        sections.append({
            "heading": heading["text"],
            "slug": heading["slug"],
            "level": heading["level"],
            "content": section_content,
        })

    # Add intro section if content starts before first heading
    if headings and headings[0]["line"] > 0:
        intro_content = "\n".join(lines[:headings[0]["line"]]).strip()
        if intro_content:
            sections.insert(0, {
                "heading": "Introduction",
                "slug": "introduction",
                "level": 1,
                "content": intro_content,
            })

    return sections


def format_page_section_result(
    section: PageSection,
    similarity: float | None = None,
) -> dict[str, Any]:
    """Format page section for API response."""
    result = {
        "section_id": str(section.id),
        "page_id": str(section.page_id),
        "content": section.content,
        "heading": section.heading,
        "slug": section.slug,
        "token_count": section.token_count,
        "created_at": section.created_at.isoformat() if section.created_at else None,
    }

    if similarity is not None:
        result["similarity"] = similarity

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


def validate_chunk_size(chunk_size: int) -> bool:
    """Validate chunk size is within reasonable limits."""
    return 100 <= chunk_size <= 10000


def validate_chunk_overlap(chunk_overlap: int, chunk_size: int) -> bool:
    """Validate chunk overlap is reasonable relative to chunk size."""
    return 0 <= chunk_overlap < chunk_size // 2


def generate_page_path(
    target_type: str | None,
    target_id: str | None,
    slug: str | None = None,
) -> str:
    """Generate a unique page path."""
    parts = []

    if target_type:
        parts.append(target_type)
    if target_id:
        parts.append(target_id)
    if slug:
        parts.append(slug)

    return "/".join(parts) if parts else f"page-{hashlib.md5(str(parts).encode()).hexdigest()[:8]}"


def parse_page_meta(meta_str: str | None) -> dict[str, Any]:
    """Parse page meta JSON string safely."""
    if not meta_str:
        return {}

    try:
        return json.loads(meta_str)
    except json.JSONDecodeError:
        return {}


def serialize_page_meta(meta: dict[str, Any] | None) -> str | None:
    """Serialize page meta to JSON string."""
    if not meta:
        return None

    try:
        return json.dumps(meta)
    except (TypeError, ValueError):
        return None
