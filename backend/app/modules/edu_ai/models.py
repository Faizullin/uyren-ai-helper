"""
Educational AI Models
Unified LMS resource model for flexible educational content management
Uses existing knowledge base infrastructure for file attachments
"""

import uuid
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any

from sqlmodel import JSON, Column, Field, SQLModel, Text

from app.modules.edu_ai.utils import safe_json_deserialize, safe_json_serialize


class LMSResourceBase(ABC):
    """Base class for LMS resource models with JSON conversion methods."""

    @abstractmethod
    def to_json(self) -> str:
        """Convert model to JSON string. Must be implemented by subclasses."""
        raise NotImplementedError("Subclasses must implement to_json method")

    @classmethod
    @abstractmethod
    def from_json(cls, json_string: str) -> "LMSResourceBase":
        """Create model instance from JSON string. Must be implemented by subclasses."""
        raise NotImplementedError("Subclasses must implement from_json class method")


class LMSResource(LMSResourceBase, SQLModel, table=True):
    """
    Unified LMS resource model for educational content.
    Replaces Course, Lesson, Assignment, Quiz models with flexible JSON-based structure.
    Uses existing knowledge base entries for file attachments.
    """

    __tablename__ = "lms_resources"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )

    # Core fields
    title: str = Field(max_length=500, index=True)
    description: str | None = None
    content: str = Field(sa_column=Column(Text))  # Large text content
    thumbnail_url: str | None = Field(default=None, max_length=2000)

    # Target reference for flexible integration
    target_type: str | None = Field(
        default=None, max_length=50, index=True
    )  # "course", "lesson", "assignment", "quiz", etc.
    target_id: uuid.UUID | None = Field(
        default=None, index=True
    )  # ID of the target entity

    # Reference to knowledge base folder for attachments
    knowledge_base_folder_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="knowledge_base_folders.id",
        ondelete="SET NULL",
        index=True
    )

    # Dynamic metadata stored as JSON
    my_metadata: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))

    # Status and visibility
    status: str = Field(
        default="active", max_length=50
    )  # active, inactive, draft, archived
    is_public: bool = Field(default=False)

    # Timestamps
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), index=True
    )
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    published_at: datetime | None = None

    def to_json(self) -> str:
        """Convert LMSResource to JSON string."""
        return safe_json_serialize(self.model_dump())

    @classmethod
    def from_json(cls, json_string: str) -> "LMSResource":
        """Create LMSResource instance from JSON string."""
        data = safe_json_deserialize(json_string, {})
        return cls(**data)
