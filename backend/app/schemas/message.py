"""ThreadMessage Pydantic schemas."""

from sqlmodel import SQLModel


class ThreadMessageCreate(SQLModel):
    """Thread message creation schema."""

    content: str
    role: str = "user"


class ThreadMessageUpdate(SQLModel):
    """Thread message update schema."""

    content: str | None = None
    role: str | None = None

