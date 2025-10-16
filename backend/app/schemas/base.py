"""Base schemas."""

from sqlmodel import SQLModel


class Message(SQLModel):
    """Generic message response."""

    message: str

