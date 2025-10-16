"""Database models."""

# Import User first, then related models to establish proper model registration order
from app.models.agent import Agent, AgentTemplate, AgentVersion
from app.models.agent_run import AgentRun, AgentRunPublic, AgentRunsPublic
from app.models.api_key import APIKey
from app.models.enums import AgentRunStatus
from app.models.project import Project, ProjectPublic, ProjectsPublic
from app.models.thread import (
    Thread,
    ThreadBase,
    ThreadMessage,
    ThreadMessageBase,
    ThreadMessagePublic,
    ThreadMessagesPublic,
    ThreadPublic,
    ThreadsPublic,
)
from app.models.user import User, UserBase, UserPublic, UsersPublic

__all__ = [
    "AgentRunStatus",
    "User",
    "UserBase",
    "UserPublic",
    "UsersPublic",
    "Project",
    "ProjectPublic",
    "ProjectsPublic",
    "Thread",
    "ThreadBase",
    "ThreadPublic",
    "ThreadsPublic",
    "ThreadMessage",
    "ThreadMessageBase",
    "ThreadMessagePublic",
    "ThreadMessagesPublic",
    "Agent",
    "AgentVersion",
    "AgentTemplate",
    "AgentRun",
    "AgentRunPublic",
    "AgentRunsPublic",
    "APIKey",
]
