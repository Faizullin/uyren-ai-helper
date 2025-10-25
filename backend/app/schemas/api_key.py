"""API Key Pydantic schemas."""

import uuid
from datetime import datetime

from sqlmodel import SQLModel


class APIKeyCreate(SQLModel):
    """API key creation schema."""

    title: str
    description: str | None = None
    project_id: uuid.UUID | None = None
    expires_at: datetime | None = None


class APIKeyUpdate(SQLModel):
    """API key update schema."""

    title: str | None = None
    description: str | None = None
    project_id: uuid.UUID | None = None
    status: str | None = None  # active, inactive, revoked
    expires_at: datetime | None = None


class APIKeyPublic(SQLModel):
    """Public API key schema for API responses."""

    id: uuid.UUID
    public_key: str
    owner_id: uuid.UUID
    project_id: uuid.UUID | None
    title: str
    description: str | None
    status: str
    expires_at: datetime | None
    last_used_at: datetime | None
    created_at: datetime
    updated_at: datetime


class APIKeyDetail(SQLModel):
    """Detailed API key schema with full information."""

    id: uuid.UUID
    public_key: str
    owner_id: uuid.UUID
    project_id: uuid.UUID | None
    title: str
    description: str | None
    status: str
    expires_at: datetime | None
    last_used_at: datetime | None
    created_at: datetime
    updated_at: datetime


class APIKeyGenerateResponse(SQLModel):
    """Response schema for API key generation."""

    id: uuid.UUID
    public_key: str
    secret_key: str  # Only returned once during creation
    title: str
    description: str | None
    project_id: uuid.UUID | None
    expires_at: datetime | None
    created_at: datetime
