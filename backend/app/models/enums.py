"""Enum definitions for models."""

from enum import StrEnum


class AgentRunStatus(StrEnum):
    """Agent run status values."""

    PENDING = "pending"
    RUNNING = "running"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


__all__ = ["AgentRunStatus"]

