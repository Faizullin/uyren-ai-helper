"""Thread Pydantic schemas."""

from sqlmodel import SQLModel


class ThreadCreate(SQLModel):
    """Thread creation schema."""

    title: str
    description: str | None = None


class ThreadUpdate(SQLModel):
    """Thread update schema."""

    title: str | None = None
    description: str | None = None

