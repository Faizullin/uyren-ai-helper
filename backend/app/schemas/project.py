"""Project Pydantic schemas."""

from sqlmodel import SQLModel


class ProjectCreate(SQLModel):
    """Project creation schema."""

    name: str
    description: str | None = None
    is_public: bool = False


class ProjectUpdate(SQLModel):
    """Project update schema."""

    name: str | None = None
    description: str | None = None
    is_public: bool | None = None

