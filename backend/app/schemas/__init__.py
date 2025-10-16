"""Pydantic schemas."""

from app.schemas.agent import AgentCreate, AgentUpdate
from app.schemas.base import Message
from app.schemas.message import ThreadMessageCreate, ThreadMessageUpdate
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.schemas.thread import ThreadCreate, ThreadUpdate
from app.schemas.user import (
    LoginRequest,
    LoginResponse,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    RegisterRequest,
    RegisterResponse,
    TokenPayload,
    UpdatePassword,
    UserCreate,
    UserUpdate,
    UserUpdateMe,
)

__all__ = [
    # Base schemas
    "Message",
    # User/Auth schemas
    "UserCreate",
    "UserUpdate",
    "UserUpdateMe",
    "UpdatePassword",
    "LoginRequest",
    "LoginResponse",
    "RegisterRequest",
    "RegisterResponse",
    "TokenPayload",
    "PasswordResetRequest",
    "PasswordResetConfirm",
    "PasswordChange",
    # Project schemas
    "ProjectCreate",
    "ProjectUpdate",
    # Thread schemas
    "ThreadCreate",
    "ThreadUpdate",
    # ThreadMessage schemas
    "ThreadMessageCreate",
    "ThreadMessageUpdate",
    # Agent schemas
    "AgentCreate",
    "AgentUpdate",
]
