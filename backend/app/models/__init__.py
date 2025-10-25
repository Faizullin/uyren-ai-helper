"""Database models."""

# Import User first, then related models to establish proper model registration order
from app.models.agent import Agent, AgentTemplate, AgentVersion
from app.models.agent_run import AgentRun
from app.models.api_key import APIKey
from app.models.billing import CreditAccount, CreditTransaction
from app.models.enums import AgentRunStatus
from app.models.knowledge_base import (
    AgentKnowledgeAssignment,
    KnowledgeBaseEntry,
    KnowledgeBaseFolder,
)
from app.models.project import Project, ProjectPublic, ProjectsPublic
from app.models.thread import (
    Thread,
    ThreadBase,
    ThreadMessage,
    ThreadMessageBase,
)
from app.models.user import User, UserBase, UserPublic, UsersPublic
from app.modules.edu_ai.models import LMSResource

# Import vector store models
# from app.modules.vector_store.models import Document, DocumentChunk, VectorStore

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
    "ThreadMessage",
    "ThreadMessageBase",
    "Agent",
    "AgentVersion",
    "AgentTemplate",
    "AgentRun",
    "APIKey",
    "KnowledgeBaseFolder",
    "KnowledgeBaseEntry",
    "AgentKnowledgeAssignment",
    "CreditAccount",
    "CreditTransaction",
    "LMSResource",
    # "VectorStore",
    # "Document",
    # "DocumentChunk",
]
