"""Agent routes."""

import hashlib
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import func, or_, select

from app.core.db import SessionDep
from app.core.logger import logger
from app.models import Agent, AgentRun, AgentRunStatus, AgentVersion
from app.modules.agents.loader import get_agent_loader
from app.modules.limits_checker import check_agent_count_limit
from app.schemas.agent import (
    AgentCreate,
    AgentDetail,
    AgentIconGenerationRequest,
    AgentIconGenerationResponse,
    AgentPublic,
    AgentUpdate,
)
from app.schemas.common import (
    PaginatedResponse,
    PaginationQueryParams,
    create_paginated_response,
    get_pagination_params,
    paginate_query,
)
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["agents"])


# ==================== Agent CRUD Endpoints ====================


@router.get(
    "/agents",
    response_model=PaginatedResponse[AgentPublic],
    tags=["agents"],
    summary="List agents with pagination, search, and filtering",
    operation_id="list_agents",
)
async def list_agents(
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
    search: str | None = Query(None),
    is_default: bool | None = Query(None),
    is_public: bool | None = Query(None),
) -> PaginatedResponse[AgentPublic]:
    """List agents with pagination, search, and filtering."""

    logger.debug(f"Fetching agents for user: {current_user.id}")

    # Base query
    query = select(Agent)
    count_query = select(func.count()).select_from(Agent)

    # Visibility rules
    if not current_user.is_superuser:
        visibility = or_(
            Agent.owner_id == current_user.id,
            Agent.is_public == True,  # noqa: E712
        )
        query = query.where(visibility)
        count_query = count_query.where(visibility)

    # Filters
    filters = []
    if is_default is not None:
        filters.append(Agent.is_default == is_default)
    if is_public is not None:
        filters.append(Agent.is_public == is_public)
    if filters:
        query = query.where(*filters)
        count_query = count_query.where(*filters)

    # Search
    if search:
        search_expr = or_(
            Agent.name.ilike(f"%{search}%"),
            Agent.description.ilike(f"%{search}%"),
        )
        query = query.where(search_expr)
        count_query = count_query.where(search_expr)

    query = query.order_by(Agent.created_at.desc())
    results, total = paginate_query(session, query, count_query, pagination)
    agents = [AgentPublic.model_validate(agent) for agent in results]

    logger.debug(f"Found {len(agents)} agents (total: {total})")

    return create_paginated_response(agents, pagination, total)


@router.get(
    "/agents/{agent_id}",
    response_model=AgentDetail,
    tags=["agents"],
    summary="Get agent details",
    operation_id="get_agent",
)
async def get_agent(
    agent_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> AgentDetail:
    """Get a single agent with full configuration."""
    logger.debug(f"Fetching agent {agent_id}")

    try:
        loader = await get_agent_loader()
        agent_data = await loader.load_agent(
            session=session,
            agent_id=agent_id,
            current_user=current_user,
            load_config=True,
        )
        return AgentDetail.model_validate(agent_data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching agent {agent_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch agent: {str(e)}")


@router.post(
    "/agents",
    response_model=AgentPublic,
    tags=["agents"],
    summary="Create Agent",
    operation_id="create_agent",
)
async def create_agent(
    session: SessionDep,
    agent_in: AgentCreate,
    current_user: CurrentUser,
) -> AgentPublic:
    """Create a new agent."""

    logger.debug(f"Creating agent for user: {current_user.id}")

    try:
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
            statement = select(Agent).where(
                Agent.owner_id == current_user.id,
                Agent.is_default == True,  # noqa: E712
            )
            existing_defaults = session.exec(statement).all()
            for existing in existing_defaults:
                existing.is_default = False
                session.add(existing)

        # Create agent
        agent = Agent(
            owner_id=current_user.id,
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
        agent.current_version_id = initial_version.id
        session.add(agent)
        session.commit()
        session.refresh(agent)

        logger.info(f"Created agent {agent.id} for user {current_user.id}")

        return AgentPublic.model_validate(agent)

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"Error creating agent: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create agent: {str(e)}")


@router.put(
    "/agents/{agent_id}",
    response_model=AgentPublic,
    tags=["agents"],
    summary="Update agent",
    operation_id="update_agent",
)
async def update_agent(
    agent_id: uuid.UUID,
    agent_data: AgentUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> AgentPublic:
    """Update an agent."""
    logger.debug(f"Updating agent {agent_id}")

    try:
        # Get agent and verify ownership
        agent = session.get(Agent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        if not current_user.is_superuser and agent.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        # Update agent fields
        update_dict = agent_data.model_dump(exclude_unset=True)

        # Handle is_default - unset other defaults
        if update_dict.get("is_default"):
            statement = select(Agent).where(
                Agent.owner_id == current_user.id,
                Agent.is_default == True,  # noqa: E712
                Agent.id != agent_id,
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

        return AgentPublic.model_validate(agent)

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"Error updating agent {agent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to update agent: {str(e)}")


@router.delete(
    "/agents/{agent_id}",
    tags=["agents"],
    summary="Delete agent",
    operation_id="delete_agent",
)
async def delete_agent(
    agent_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict:
    """Delete an agent."""
    logger.debug(f"Deleting agent: {agent_id}")

    try:
        agent = session.get(Agent, agent_id)
        if not agent:
            raise HTTPException(status_code=404, detail="Agent not found")

        if not current_user.is_superuser and agent.owner_id != current_user.id:
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

        return {"message": "Agent deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        session.rollback()
        logger.error(f"Error deleting agent {agent_id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to delete agent: {str(e)}")


@router.post(
    "/agents/generate-icon",
    response_model=AgentIconGenerationResponse,
    tags=["agents"],
    summary="Generate Agent Icon",
    operation_id="generate_agent_icon",
)
async def generate_agent_icon(
    request: AgentIconGenerationRequest,
) -> AgentIconGenerationResponse:
    """Generate an appropriate icon and colors for an agent based on its name."""
    logger.debug(f"Generating icon and colors for agent: {request.name}")

    try:
        # Simple icon generation logic based on name
        name_lower = request.name.lower()

        # Icon mapping based on common agent names/patterns
        icon_map = {
            "assistant": "user-tie",
            "helper": "hands-helping",
            "teacher": "chalkboard-teacher",
            "writer": "pen-fancy",
            "coder": "code",
            "analyst": "chart-line",
            "manager": "user-tie",
            "bot": "robot",
            "ai": "brain",
            "chat": "comments",
            "support": "headset",
        }

        # Find matching icon or default
        icon_name = "bot"  # default
        for keyword, icon in icon_map.items():
            if keyword in name_lower:
                icon_name = icon
                break

        # Color generation based on name hash
        name_hash = hashlib.md5(request.name.encode()).hexdigest()

        # Generate colors from hash
        color_index = int(name_hash[:2], 16)
        background_index = int(name_hash[2:4], 16)

        colors = [
            "#3B82F6",
            "#EF4444",
            "#10B981",
            "#F59E0B",
            "#8B5CF6",
            "#EC4899",
            "#06B6D4",
            "#84CC16",
        ]
        backgrounds = [
            "#F3F4F6",
            "#FEF3C7",
            "#DCFCE7",
            "#FEE2E2",
            "#E0E7FF",
            "#FCE7F3",
            "#CFFAFE",
            "#ECFCCB",
        ]

        icon_color = colors[color_index % len(colors)]
        icon_background = backgrounds[background_index % len(backgrounds)]

        response = AgentIconGenerationResponse(
            icon_name=icon_name, icon_color=icon_color, icon_background=icon_background
        )

        logger.debug(
            f"Generated agent icon: {response.icon_name}, colors: {response.icon_color}/{response.icon_background}"
        )
        return response

    except Exception as e:
        logger.error(f"Error generating agent icon: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to generate agent icon: {str(e)}"
        )
