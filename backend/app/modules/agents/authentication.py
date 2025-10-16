"""Minimal async authorization for agents module."""

import uuid

from fastapi import HTTPException
from sqlmodel import Session

from app.core.logger import logger
from app.models import Agent, Thread, User

# ==================== Thread Authorization (Async) ====================


async def verify_thread_access(
    session: Session,
    thread_id: uuid.UUID,
    current_user: User,
) -> Thread:
    """
    Async: Verify user has access to a thread.

    Access granted if:
    1. User is superuser (admin access)
    2. User owns the thread
    3. Thread belongs to a public project (read-only for non-owners)

    Used for both read and write operations.
    For write operations, only owners and superusers can modify.
    For read operations, public project members can also view.
    """
    try:
        thread = session.get(Thread, thread_id)
        if not thread:
            raise HTTPException(status_code=404, detail="Thread not found")

        # Check if user is a superuser first (admins have access to all threads)
        if current_user.is_superuser:
            logger.debug(
                f"Admin access granted for thread {thread_id}", user_role="superuser"
            )
            return thread

        # Check if user owns the thread
        if thread.owner_id == current_user.id:
            logger.debug(f"Owner access granted for thread {thread_id}")
            return thread

        # Check if thread belongs to a public project
        if thread.project_id:
            from app.models import Project

            project = session.get(Project, thread.project_id)
            if project and project.is_public:
                logger.debug(f"Public project access granted for thread {thread_id}")
                return thread

        # Access denied
        logger.warning(
            f"Access denied for user {current_user.id} to thread {thread_id}"
        )
        raise HTTPException(
            status_code=403, detail="Not authorized to access this thread"
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        # Handle database connection issues gracefully
        if (
            "cannot schedule new futures after shutdown" in error_msg
            or "connection is closed" in error_msg
        ):
            logger.error(
                f"Database connection error during thread access check: {error_msg}"
            )
            raise HTTPException(status_code=503, detail="Server is shutting down")
        else:
            logger.error(f"Error verifying thread access: {error_msg}")
            raise HTTPException(
                status_code=500, detail=f"Error verifying thread access: {str(e)}"
            )


# ==================== Agent Authorization (Async) ====================


async def verify_agent_access(
    session: Session,
    agent_id: uuid.UUID,
    current_user: User,
) -> Agent:
    """
    Async: Verify user has access to an agent.

    Used in: agents/loader.py
    """
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if (
        current_user.is_superuser
        or agent.owner_id == current_user.id
        or agent.is_public
    ):
        logger.debug(f"Agent access granted for {agent_id}")
        return agent

    logger.warning(f"Access denied for user {current_user.id} to agent {agent_id}")
    raise HTTPException(status_code=403, detail="Not authorized to access this agent")


__all__ = [
    "verify_thread_access",
    "verify_agent_access",
]
