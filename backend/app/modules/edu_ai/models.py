"""
Educational AI Grading Models
Dynamic schema to handle any third-party submission data
"""

import uuid
from datetime import datetime, timezone

from sqlmodel import JSON, Column, Field, SQLModel


class Assignment(SQLModel, table=True):
    """
    Assignment configuration - defines what to grade and how
    Supports two types: "assignment" (homework with files) and "quiz" (questions with answers)
    Stores settings for AI grading and third-party API integration
    """

    __tablename__ = "assignments"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )

    # Basic info
    title: str = Field(max_length=255)
    description: str | None = None
    assignment_type: str = Field(default="assignment")  # "assignment" or "quiz"

    # Third-party API configuration
    thirdparty_api_url: str  # Where to fetch submission data from
    thirdparty_webhook_url: str | None = None  # Where to POST results back
    api_key_id: uuid.UUID | None = Field(
        foreign_key="api_keys.id", default=None
    )  # For auth
    thirdparty_assignment_id: str  # Their internal assignment ID

    # Quiz questions (only for type="quiz")
    questions: dict = Field(default={}, sa_column=Column(JSON))
    # Example quiz structure:
    # {
    #     "questions": [
    #         {
    #             "id": "q1",
    #             "type": "multiple_choice",
    #             "question": "What is 2+2?",
    #             "options": ["2", "3", "4", "5"],
    #             "correct_answer": "4",
    #             "points": 10
    #         },
    #         {
    #             "id": "q2",
    #             "type": "short_answer",
    #             "question": "Explain photosynthesis",
    #             "points": 20
    #         }
    #     ]
    # }

    # Grading settings (all in one JSONB field for flexibility)
    settings: dict = Field(default={}, sa_column=Column(JSON))
    # Example settings structure:
    # {
    #     "auto_grade": true,
    #     "require_manual_review": false,
    #     "use_rag": false,
    #     "grading_model": "gpt-5-mini",
    #     "teacher_instructions": "Focus on code quality",
    #     "rubric": {"code_quality": 30, "functionality": 50, "docs": 20},
    #     "max_points": 100,
    #     "rag_sources": [],
    #     "fetch_pagination": {"enabled": true, "page_size": 50}
    # }

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class GradingSession(SQLModel, table=True):
    """
    Single unified table for ALL grading data
    Stores third-party submission data + grading results dynamically
    """

    __tablename__ = "grading_sessions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    assignment_id: uuid.UUID = Field(
        foreign_key="assignments.id", nullable=False, index=True
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )

    # Third-party data (stored as-is, no schema assumptions)
    thirdparty_data: dict = Field(default={}, sa_column=Column(JSON))
    # Example structure from third-party API:
    # {
    #     "submission_id": "ext_12345",
    #     "student": {
    #         "id": "student_789",
    #         "name": "John Doe",
    #         "email": "john@example.com"
    #     },
    #     "submission": {
    #         "content": "Student's essay text...",
    #         "files": ["https://api.example.com/files/1", "https://api.example.com/files/2"],
    #         "submitted_at": "2025-10-12T10:30:00Z"
    #     },
    #     "metadata": {...}
    # }

    # Grading workflow state
    status: str = Field(
        default="pending", index=True
    )  # pending, processing, graded, reviewed, failed
    current_step: str | None = None  # Which grading step is running
    progress: int = Field(default=0)  # 0-100

    # Grading results (also dynamic JSONB)
    results: dict = Field(default={}, sa_column=Column(JSON))
    # Example results structure:
    # {
    #     "grade": 85.5,
    #     "max_points": 100,
    #     "feedback": "Great work! Here's what you did well...",
    #     "rubric_scores": {
    #         "code_quality": {"score": 25, "max": 30, "reason": "..."},
    #         "functionality": {"score": 45, "max": 50, "reason": "..."}
    #     },
    #     "analysis": "Detailed AI analysis...",
    #     "model_used": "gpt-5-mini",
    #     "graded_by": "ai",
    #     "graded_at": "2025-10-12T11:00:00Z"
    # }

    # Error tracking
    error: str | None = None
    retry_count: int = Field(default=0)

    # Timestamps
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CourseMaterial(SQLModel, table=True):
    """
    Reference materials for RAG-enhanced grading
    Stores course content with vector embeddings
    """

    __tablename__ = "course_materials"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    assignment_id: uuid.UUID | None = Field(foreign_key="assignments.id", index=True)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )

    title: str = Field(max_length=255)
    content: str  # Full text content
    file_url: str | None = None

    # Vector embedding for similarity search (requires pgvector extension)
    # embedding: list[float] | None = None  # Uncomment when pgvector is enabled

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
