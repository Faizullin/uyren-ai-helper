"""Agent Pydantic schemas."""

from sqlmodel import SQLModel


class AgentCreate(SQLModel):
    """Agent creation schema."""

    name: str
    description: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    is_default: bool = False
    tags: list[str] | None = None
    icon_name: str | None = None
    icon_color: str | None = None
    icon_background: str | None = None


class AgentUpdate(SQLModel):
    """Agent update schema."""

    name: str | None = None
    description: str | None = None
    system_prompt: str | None = None
    model: str | None = None
    is_default: bool | None = None
    is_public: bool | None = None
    tags: list[str] | None = None
    icon_name: str | None = None
    icon_color: str | None = None
    icon_background: str | None = None

