"""Educational AI Pydantic schemas."""

import uuid
from datetime import datetime
from typing import Any

from sqlmodel import SQLModel

from app.modules.edu_ai.utils import safe_json_serialize


class LMSResourceCreate(SQLModel):
    """LMS resource creation schema."""

    title: str
    description: str | None = None
    content: str
    thumbnail_url: str | None = None
    target_type: str | None = None
    target_id: uuid.UUID | None = None
    knowledge_base_folder_id: uuid.UUID | None = None
    my_metadata: dict[str, Any] = {}
    status: str = "active"
    is_public: bool = False

    def validate_metadata(self) -> "LMSResourceCreate":
        """Validate and clean metadata."""
        if not isinstance(self.my_metadata, dict):
            self.my_metadata = {}
        return self

    def get_metadata_json(self) -> str:
        """Get metadata as JSON string."""
        return safe_json_serialize(self.my_metadata)


class LMSResourceUpdate(SQLModel):
    """LMS resource update schema."""

    title: str | None = None
    description: str | None = None
    content: str | None = None
    thumbnail_url: str | None = None
    target_type: str | None = None
    target_id: uuid.UUID | None = None
    knowledge_base_folder_id: uuid.UUID | None = None
    my_metadata: dict[str, Any] | None = None
    status: str | None = None
    is_public: bool | None = None

    def validate_metadata(self) -> "LMSResourceUpdate":
        """Validate and clean metadata if provided."""
        if self.my_metadata is not None and not isinstance(self.my_metadata, dict):
            self.my_metadata = {}
        return self


class LMSResourcePublic(SQLModel):
    """Public LMS resource schema for API responses."""

    id: uuid.UUID
    owner_id: uuid.UUID
    title: str
    description: str | None
    content: str
    thumbnail_url: str | None
    target_type: str | None
    target_id: uuid.UUID | None
    knowledge_base_folder_id: uuid.UUID | None
    my_metadata: dict[str, Any]
    status: str
    is_public: bool
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


class LMSResourceDetail(LMSResourcePublic):
    """Detailed LMS resource schema (inherits from public)."""

    # No additional fields for now, but can be extended
    pass


# Example LMS metadata structures for different resource types
LMS_METADATA_EXAMPLES = {
    "course": {
        "type": "course",
        "instructor": "Dr. Smith",
        "credits": 3,
        "duration_weeks": 12,
        "prerequisites": ["CS101", "MATH201"],
        "objectives": ["Learn programming", "Understand algorithms"],
        "schedule": {"start_date": "2024-01-15", "end_date": "2024-04-15"},
    },
    "lesson": {
        "type": "lesson",
        "course_id": "course_123",
        "module": "Module 1",
        "duration_minutes": 45,
        "video_url": "https://example.com/video.mp4",
        "slides_url": "https://example.com/slides.pdf",
        "reading_materials": ["Chapter 1", "Chapter 2"],
    },
    "assignment": {
        "type": "assignment",
        "course_id": "course_123",
        "due_date": "2024-02-15T23:59:59Z",
        "max_points": 100,
        "instructions": "Complete the programming exercise...",
        "rubric": {"code_quality": 30, "functionality": 50, "documentation": 20},
        "allowed_file_types": [".py", ".java", ".cpp"],
        "max_file_size_mb": 10,
    },
    "quiz": {
        "type": "quiz",
        "course_id": "course_123",
        "time_limit_minutes": 30,
        "max_attempts": 3,
        "passing_score": 70,
        "questions": [
            {
                "id": "q1",
                "type": "multiple_choice",
                "question": "What is the time complexity of binary search?",
                "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"],
                "correct_answer": "O(log n)",
                "points": 10,
            }
        ],
        "randomize_questions": True,
        "show_correct_answers": False,
    },
}
