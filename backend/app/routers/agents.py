"""Agent routes."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import func, select

from app.core.db import SessionDep
from app.core.logger import logger
from app.models import Agent, AgentRun, AgentRunStatus, AgentVersion
from app.schemas import AgentCreate, AgentUpdate, Message
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["agents"])


# ==================== Agent CRUD Endpoints ====================


@router.get("/agents")
async def get_agents(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    search: str | None = Query(None),
    is_default: bool | None = Query(None),
    is_public: bool | None = Query(None),
) -> dict:
    """
    List agents with pagination and filters.

    Users see their own agents + public agents.
    """
    logger.debug(f"Fetching agents for user: {current_user.id}")

    # Build query
    statement = select(Agent)
    count_statement = select(func.count()).select_from(Agent)

    # Filter by ownership or public
    if not current_user.is_superuser:
        from sqlmodel import or_
        statement = statement.where(
            or_(
                Agent.owner_id == current_user.id,
                Agent.is_public == True  # noqa: E712
            )
        )
        count_statement = count_statement.where(
            or_(
                Agent.owner_id == current_user.id,
                Agent.is_public == True  # noqa: E712
            )
        )

    # Apply filters
    if search:
        statement = statement.where(Agent.name.ilike(f"%{search}%"))
        count_statement = count_statement.where(Agent.name.ilike(f"%{search}%"))

    if is_default is not None:
        statement = statement.where(Agent.is_default == is_default)
        count_statement = count_statement.where(Agent.is_default == is_default)

    if is_public is not None:
        statement = statement.where(Agent.is_public == is_public)
        count_statement = count_statement.where(Agent.is_public == is_public)

    # Get total count
    total = session.exec(count_statement).one()

    # Apply pagination and ordering
    statement = statement.order_by(Agent.created_at.desc()).offset(skip).limit(limit)
    agents = session.exec(statement).all()

    logger.debug(f"Found {len(agents)} agents (total: {total})")

    return {
        "agents": [
            {
                "agent_id": str(agent.id),
                "name": agent.name,
                "description": agent.description,
                "is_default": agent.is_default,
                "is_public": agent.is_public,
                "icon_name": agent.icon_name,
                "icon_color": agent.icon_color,
                "icon_background": agent.icon_background,
                "tags": agent.tags,
                "version_count": agent.version_count,
                "created_at": agent.created_at.isoformat(),
                "updated_at": agent.updated_at.isoformat(),
            }
            for agent in agents
        ],
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit,
            "page": (skip // limit) + 1,
            "total_pages": (total + limit - 1) // limit,
        },
    }


@router.get("/agents/{agent_id}")
async def get_agent(
    agent_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict:
    """Get a single agent with full configuration."""
    logger.debug(f"Fetching agent {agent_id}")

    from app.modules.agents.loader import get_agent_loader

    try:
        loader = await get_agent_loader()
        agent_data = await loader.load_agent(
            session=session,
            agent_id=agent_id,
            current_user=current_user,
            load_config=True,
        )

        return agent_data.to_dict()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching agent {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch agent: {str(e)}")


@router.post("/agents")
async def create_agent(
    session: SessionDep,
    agent_in: AgentCreate,
    current_user: CurrentUser,
) -> dict:
    """Create a new agent."""
    logger.debug(f"Creating agent for user: {current_user.id}")

    try:
        # Check agent count limit
        from app.modules.limits_checker import check_agent_count_limit

        limit_check = await check_agent_count_limit(session, current_user.id)

        if not limit_check["can_create"]:
            raise HTTPException(
                status_code=402,
                detail={
                    "message": f"Maximum of {limit_check['limit']} agents allowed. You have {limit_check['current_count']} agents.",
                    "current_count": limit_check["current_count"],
                    "limit": limit_check["limit"],
                    "tier_name": limit_check["tier_name"],
                    "error_code": "AGENT_LIMIT_EXCEEDED",
                },
            )

        # If setting as default, unset other defaults
        if agent_in.is_default:
            statement = (
                select(Agent)
                .where(
                    Agent.owner_id == current_user.id,
                    Agent.is_default == True  # noqa: E712
                )
            )
            existing_defaults = session.exec(statement).all()
            for existing in existing_defaults:
                existing.is_default = False
                session.add(existing)

        # Create agent
        agent = Agent(
            account_id=current_user.id,
            name=agent_in.name,
            description=agent_in.description,
            system_prompt=agent_in.system_prompt or "You are a helpful AI assistant.",
            is_default=agent_in.is_default or False,
            is_public=False,
            tags=agent_in.tags or [],
            icon_name=agent_in.icon_name or "bot",
            icon_color=agent_in.icon_color or "#000000",
            icon_background=agent_in.icon_background or "#F3F4F6",
            configured_mcps=[],
            custom_mcps=[],
            agentpress_tools={},
            version_count=1,
        )
        session.add(agent)
        session.flush()

        # Create initial version
        initial_version = AgentVersion(
            agent_id=agent.id,
            version_number=1,
            version_name="v1",
            system_prompt=agent.system_prompt,
            model=agent_in.model or "gpt-4",
            configured_mcps=[],
            custom_mcps=[],
            agentpress_tools={},
            is_active=True,
            status="active",
            config={},
            created_by=current_user.id,
            change_description="Initial version",
        )
        session.add(initial_version)
        session.flush()

        # Update agent with version reference
        agent.current_version_id = initial_version.version_id
        session.add(agent)
        session.commit()
        session.refresh(agent)

        logger.info(f"Created agent {agent.id} for user {current_user.id}")

        return {
            "agent_id": str(agent.id),
            "name": agent.name,
            "description": agent.description,
            "system_prompt": agent.system_prompt,
            "is_default": agent.is_default,
            "is_public": agent.is_public,
            "tags": agent.tags,
            "icon_name": agent.icon_name,
            "icon_color": agent.icon_color,
            "icon_background": agent.icon_background,
            "version_count": agent.version_count,
            "created_at": agent.created_at.isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"Error creating agent: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create agent: {str(e)}")


@router.put("/agents/{agent_id}")
async def update_agent(
    agent_id: uuid.UUID,
    agent_data: AgentUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict:
    """Update an agent."""
    logger.debug(f"Updating agent {agent_id}")

    # Get agent and verify ownership
    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not current_user.is_superuser and agent.account_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    # Update agent fields
    update_dict = agent_data.model_dump(exclude_unset=True)

    # Handle is_default
    if update_dict.get("is_default"):
        # Unset other defaults
        statement = (
            select(Agent)
            .where(
                Agent.owner_id == current_user.id,
                Agent.is_default == True,  # noqa: E712
                Agent.agent_id != agent_id,
            )
        )
        existing_defaults = session.exec(statement).all()
        for existing in existing_defaults:
            existing.is_default = False
            session.add(existing)

    # Update agent
    agent.sqlmodel_update(update_dict)
    agent.updated_at = datetime.now(timezone.utc)
    session.add(agent)
    session.commit()
    session.refresh(agent)

    logger.info(f"Updated agent {agent_id}")

    return {
        "agent_id": str(agent.id),
        "name": agent.name,
        "description": agent.description,
        "is_default": agent.is_default,
        "is_public": agent.is_public,
        "tags": agent.tags,
        "icon_name": agent.icon_name,
        "icon_color": agent.icon_color,
        "icon_background": agent.icon_background,
        "updated_at": agent.updated_at.isoformat(),
    }


@router.delete("/agents/{agent_id}")
async def delete_agent(
    agent_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete an agent."""
    logger.debug(f"Deleting agent: {agent_id}")

    agent = session.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if not current_user.is_superuser and agent.account_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if agent.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete default agent")

    # Check if agent has active runs
    active_run_stmt = (
        select(func.count())
        .select_from(AgentRun)
        .where(
            AgentRun.agent_id == agent_id,
            AgentRun.status == AgentRunStatus.RUNNING,
        )
    )
    active_count = session.exec(active_run_stmt).one()

    if active_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete agent with {active_count} active runs. Stop them first.",
        )

    # Delete agent (cascade deletes versions)
    session.delete(agent)
    session.commit()

    logger.info(f"Deleted agent {agent_id}")

    return Message(message="Agent deleted successfully")
