"""Subscription limit checking utilities."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlmodel import Session, func, select

from app.core.config import settings
from app.core.logger import logger
from app.models import Agent, AgentRun, AgentRunStatus, Project, User

# Limit constants
MAX_PARALLEL_AGENT_RUNS = 5  # Maximum parallel runs per user
MAX_PROJECTS_FREE = 3  # Free tier
MAX_PROJECTS_PAID = 50  # Paid tier
MAX_AGENTS_FREE = 3  # Free tier
MAX_AGENTS_PAID = 50  # Paid tier


async def check_agent_run_limit(
    session: Session,
    user_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Check if user has reached the limit of parallel agent runs within past 24 hours.

    Args:
        session: Database session
        user_id: User ID to check

    Returns:
        Dict with 'can_start' (bool), 'running_count' (int), 'running_thread_ids' (list)
    """
    try:
        # In local mode, allow unlimited runs
        if settings.ENVIRONMENT == "local":
            return {
                "can_start": True,
                "running_count": 0,
                "limit": 999999,
            }

        # Calculate cutoff time (24 hours ago)
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)

        # Count running agent runs for user's agents in past 24 hours
        running_count_stmt = (
            select(func.count())
            .select_from(AgentRun)
            .join(Agent, AgentRun.agent_id == Agent.id)
            .where(
                Agent.owner_id == user_id,
                AgentRun.status == AgentRunStatus.RUNNING,
                AgentRun.started_at > cutoff_time,
            )
        )

        running_count = session.exec(running_count_stmt).one()

        logger.debug(
            f"User {user_id} has {running_count} running agent runs in past 24 hours"
        )

        can_start = running_count < MAX_PARALLEL_AGENT_RUNS

        return {
            "can_start": can_start,
            "running_count": running_count,
            "limit": MAX_PARALLEL_AGENT_RUNS,
        }

    except Exception as e:
        logger.error(f"Error checking agent run limit for user {user_id}: {str(e)}")
        # On error, allow the run to proceed (fail open)
        return {
            "can_start": True,
            "running_count": 0,
            "limit": MAX_PARALLEL_AGENT_RUNS,
        }


async def check_agent_count_limit(
    session: Session,
    user_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Check if user can create more agents based on their subscription tier.

    Args:
        session: Database session
        user_id: User ID to check

    Returns:
        Dict with 'can_create', 'current_count', 'limit', 'tier_name'
    """
    try:
        # In local mode, allow unlimited agents
        if settings.ENVIRONMENT == "local":
            return {
                "can_create": True,
                "current_count": 0,
                "limit": 999999,
                "tier_name": "local",
            }

        # Count user's agents
        count_stmt = select(func.count()).select_from(Agent).where(Agent.id == user_id)
        current_count = session.exec(count_stmt).one()

        # Determine user tier (simplified - you can integrate billing here)
        # TODO: Integrate with billing system to get actual tier
        tier_name = "free"  # Default to free tier
        agent_limit = MAX_AGENTS_FREE

        # Check if user is superuser or has paid subscription
        user = session.get(User, user_id)
        if user and user.is_superuser:
            tier_name = "admin"
            agent_limit = 999999
        # TODO: Check subscription status from billing system
        # elif has_paid_subscription(user_id):
        #     tier_name = "paid"
        #     agent_limit = MAX_AGENTS_PAID

        can_create = current_count < agent_limit

        logger.debug(
            f"User {user_id} has {current_count}/{agent_limit} agents (tier: {tier_name}) - can_create: {can_create}"
        )

        return {
            "can_create": can_create,
            "current_count": current_count,
            "limit": agent_limit,
            "tier_name": tier_name,
        }

    except Exception as e:
        logger.error(
            f"Error checking agent count limit for user {user_id}: {str(e)}",
            exc_info=True,
        )
        return {
            "can_create": True,
            "current_count": 0,
            "limit": MAX_AGENTS_FREE,
            "tier_name": "free",
        }


async def check_project_count_limit(
    session: Session,
    user_id: uuid.UUID,
) -> dict[str, Any]:
    """
    Check if user can create more projects based on their subscription tier.

    Args:
        session: Database session
        user_id: User ID to check

    Returns:
        Dict with 'can_create', 'current_count', 'limit', 'tier_name'
    """
    try:
        # In local mode, allow unlimited projects
        if settings.ENVIRONMENT == "local":
            return {
                "can_create": True,
                "current_count": 0,
                "limit": 999999,
                "tier_name": "local",
            }

        # Count user's projects
        count_stmt = (
            select(func.count()).select_from(Project).where(Project.id == user_id)
        )
        current_count = session.exec(count_stmt).one()

        # Determine user tier
        tier_name = "free"
        project_limit = MAX_PROJECTS_FREE

        user = session.get(User, user_id)
        if user and user.is_superuser:
            tier_name = "admin"
            project_limit = 999999
        # TODO: Integrate with billing system
        # elif has_paid_subscription(user_id):
        #     tier_name = "paid"
        #     project_limit = MAX_PROJECTS_PAID

        can_create = current_count < project_limit

        logger.debug(
            f"User {user_id} has {current_count}/{project_limit} projects (tier: {tier_name}) - can_create: {can_create}"
        )

        return {
            "can_create": can_create,
            "current_count": current_count,
            "limit": project_limit,
            "tier_name": tier_name,
        }

    except Exception as e:
        logger.error(
            f"Error checking project count limit for user {user_id}: {str(e)}",
            exc_info=True,
        )
        return {
            "can_create": True,
            "current_count": 0,
            "limit": MAX_PROJECTS_FREE,
            "tier_name": "free",
        }


__all__ = [
    "check_agent_run_limit",
    "check_agent_count_limit",
    "check_project_count_limit",
    "MAX_PARALLEL_AGENT_RUNS",
    "MAX_PROJECTS_FREE",
    "MAX_PROJECTS_PAID",
    "MAX_AGENTS_FREE",
    "MAX_AGENTS_PAID",
]
