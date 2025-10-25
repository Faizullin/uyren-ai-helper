"""API Key model for third-party integrations."""

import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class APIKey(SQLModel, table=True):
    """
    API keys for third-party integrations
    Used for authenticating requests from external systems
    """

    __tablename__ = "api_keys"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    public_key: str = Field(unique=True, index=True)  # Public identifier
    secret_key_hash: str  # Hashed secret (bcrypt)
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE", index=True
    )
    project_id: uuid.UUID | None = Field(
        default=None, foreign_key="projects.id", ondelete="CASCADE", index=True
    )

    title: str = Field(max_length=255)  # Friendly name
    description: str | None = None

    status: str = Field(default="active")  # active, inactive, revoked
    expires_at: datetime | None = None
    last_used_at: datetime | None = None

    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
