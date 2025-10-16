"""Agent run routes."""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlmodel import Session, SQLModel, select

from app.core import redis
from app.core.config import settings
from app.core.db import SessionDep
from app.core.logger import logger
from app.models import (
    Agent,
    AgentRun,
    AgentRunStatus,
    Project,
    Thread,
    ThreadMessage,
    User,
)
from app.modules.agents.authentication import verify_thread_access
from app.modules.agents.loader import get_agent_loader
from app.modules.agents.run_manager import stop_agent_run_with_helpers
from app.modules.ai_models.manager import model_manager
from app.modules.limits_checker import check_agent_run_limit
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["agent-runs"])


# ==================== Helper Functions ====================


async def _get_agent_run_with_access_check(
    session: Session,
    agent_run_id: uuid.UUID,
    current_user: User,
) -> AgentRun:
    """
    Get an agent run and verify user has access to it.

    Internal helper for this module only.
    """
    agent_run = session.get(AgentRun, agent_run_id)
    if not agent_run:
        raise HTTPException(status_code=404, detail="Agent run not found")

    # Verify access via thread
    await verify_thread_access(session, agent_run.thread_id, current_user)

    return agent_run


class AgentStartRequest(SQLModel):
    """Agent start request schema."""

    agent_id: uuid.UUID | None = None
    model_name: str | None = None


class AgentStartResponse(SQLModel):
    """Agent start response schema."""

    agent_run_id: uuid.UUID
    status: str = "running"


class InitiateAgentResponse(SQLModel):
    """Agent initiation response schema."""

    thread_id: uuid.UUID
    agent_run_id: uuid.UUID
    message: str = "Agent session initiated successfully"


@router.post(
    "/threads/{thread_id}/agent/start",
    response_model=AgentStartResponse,
    summary="Start Agent Run",
    operation_id="start_agent_run",
)
async def start_agent(
    thread_id: uuid.UUID,
    body: AgentStartRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> AgentStartResponse:
    """
    Start an agent for a specific thread in the background.

    This endpoint:
    1. Loads the thread and verifies access
    2. Loads the specified agent (or default agent if not specified)
    3. Creates an agent run record
    4. Triggers background agent execution
    """
    logger.debug(f"[AGENT START] Starting agent for thread: {thread_id}")

    # 1. Verify thread access and load thread
    thread = await verify_thread_access(session, thread_id, current_user)

    # 2. Resolve model name
    model_name = body.model_name
    logger.debug(f"Original model_name from request: {model_name}")

    if model_name:
        # Log the model name after alias resolution
        resolved_model = model_manager.resolve_model_id(model_name)
        logger.debug(f"Resolved model name: {resolved_model}")
        model_name = resolved_model

    logger.debug(
        f"Starting new agent for thread: {thread_id} with config: model={model_name}"
    )

    # 3. Load agent configuration using unified loader
    loader = await get_agent_loader()
    agent_data = None
    effective_agent_id = body.agent_id

    logger.debug(f"[AGENT LOAD] Loading agent: {effective_agent_id or 'default'}")

    if effective_agent_id:
        # Try to load specified agent
        try:
            agent_data = await loader.load_agent(
                session=session,
                agent_id=effective_agent_id,
                current_user=current_user,
                load_config=True,
            )
            logger.debug(
                f"Using agent {agent_data.name} ({effective_agent_id}) version {agent_data.version_name}"
            )
        except HTTPException:
            # Explicit agent not found - fail
            raise
    else:
        # Load default agent
        logger.debug("[AGENT LOAD] Loading default agent")
        agent_data = await loader.load_default_agent(
            session=session,
            current_user=current_user,
            load_config=True,
        )

        if agent_data:
            logger.debug(
                f"Using default agent: {agent_data.name} ({agent_data.id}) version {agent_data.version_name}"
            )
        else:
            logger.warning(
                f"[AGENT LOAD] No default agent found for account {current_user.id}"
            )

    if agent_data:
        logger.debug(
            f"Using agent {agent_data.id} for this agent run (thread remains agent-agnostic)"
        )

    # 4. Determine effective model
    effective_model = model_name
    if not model_name and agent_data and agent_data.model:
        effective_model = agent_data.model
        logger.debug(
            f"No model specified by user, using agent's configured model: {effective_model}"
        )
    elif model_name:
        logger.debug(f"Using user-selected model: {effective_model}")
    else:
        logger.debug(f"Using default model: {effective_model}")

    # 5. Create Agent Run
    agent_run_metadata: dict[str, Any] = {
        "model_name": effective_model,
    }

    if agent_data and agent_data.system_prompt:
        agent_run_metadata["system_prompt_preview"] = agent_data.system_prompt[:100]

        agent_run = AgentRun(
            thread_id=thread.id,
            agent_id=agent_data.id if agent_data else None,
            agent_version_id=agent_data.current_version_id if agent_data else None,
            status=AgentRunStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
            my_metadata=agent_run_metadata,
        )
        session.add(agent_run)
        session.commit()
        session.refresh(agent_run)
        logger.debug(f"Created new agent run: {agent_run.id}")

        # 6. Register run in Redis for tracking
        instance_key = f"active_run:agent:{agent_run.id}"
        try:
            await redis.set(instance_key, "running", ex=redis.REDIS_KEY_TTL)
            logger.debug(f"Registered agent run in Redis: {instance_key}")
        except Exception as e:
            logger.warning(f"Failed to register in Redis: {e}")

        # 7. Dispatch background task for agent execution
        from app.tasks.agent_tasks import execute_agent_run

        execute_agent_run.send(
            agent_run_id=str(agent_run.id),
            thread_id=str(thread.id),
            model_name=effective_model,
        )
        logger.info(f"Dispatched background task for agent run {agent_run.id}")

        return AgentStartResponse(
            agent_run_id=agent_run.id,
            status="running",
        )


@router.post(
    "/agent/initiate",
    response_model=InitiateAgentResponse,
    summary="Initiate Agent Session",
    operation_id="initiate_agent_session",
)
async def initiate_agent_with_files(
    session: SessionDep,
    current_user: CurrentUser,
    prompt: str = Form(...),
    model_name: str | None = Form(None),
    agent_id: str | None = Form(None),
    files: list[UploadFile] = File(default=[]),
) -> InitiateAgentResponse:
    """
    Initiate a new agent session with optional file attachments.

    This endpoint:
    1. Loads the specified agent (or default agent if not specified)
    2. Creates a new thread for the conversation
    3. Adds the initial user message to the thread
    4. Creates an agent run record
    5. Optionally handles file uploads (stored as metadata)
    """
    logger.debug(
        f"Initiating new agent with prompt and {len(files)} files, model: {model_name}"
    )

    # 1. Resolve model name
    logger.debug(f"Original model_name from request: {model_name}")

    if model_name is None:
        # Use tier-based default model from registry
        model_name = await model_manager.get_default_model_for_user(current_user.id)
        logger.debug(f"Using tier-based default model: {model_name}")

    # Log the model name after alias resolution
    resolved_model = model_manager.resolve_model_id(model_name)
    logger.debug(f"Resolved model name: {resolved_model}")

    # Update model_name to use the resolved version
    model_name = resolved_model

    # 2. Load agent configuration using unified loader
    loader = await get_agent_loader()
    agent_data = None

    logger.debug(f"[AGENT INITIATE] Loading agent: {agent_id or 'default'}")

    if agent_id:
        # Load specified agent with access check
        try:
            agent_uuid = uuid.UUID(agent_id)
            agent_data = await loader.load_agent(
                session=session,
                agent_id=agent_uuid,
                current_user=current_user,
                load_config=True,
            )
            logger.debug(
                f"Using agent '{agent_data.name}' version {agent_data.version_name or 'N/A'}"
            )
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid agent_id format")
    else:
        # Load default agent for the user
        agent_data = await loader.load_default_agent(
            session=session,
            current_user=current_user,
            load_config=True,
        )

        if agent_data:
            logger.debug(f"Using default agent: '{agent_data.name}'")
        else:
            logger.warning(f"No default agent found for user {current_user.id}")

    # 3. Check rate limits (only if not in local mode)
    if settings.ENVIRONMENT != "local":
        # Check agent run limit using limits checker
        limit_check = await check_agent_run_limit(session, current_user.id)

        if not limit_check["can_start"]:
            logger.warning(
                f"Agent run limit exceeded for user {current_user.id}: "
                f"{limit_check['running_count']} running agents"
            )
            raise HTTPException(
                status_code=429,
                detail={
                    "message": f"Maximum of {limit_check['limit']} parallel agent runs allowed within 24 hours. "
                    f"You currently have {limit_check['running_count']} running.",
                    "running_count": limit_check["running_count"],
                    "limit": limit_check["limit"],
                },
            )

    # 4. Create Project (optional grouping)
    project = None
    try:
        placeholder_name = f"{prompt[:30]}..." if len(prompt) > 30 else prompt
        project = Project(
            name=placeholder_name,
            owner_id=current_user.id,
            description="Auto-generated project from agent session",
            is_public=False,
        )
        session.add(project)
        session.flush()
        logger.info(f"Created new project: {project.id}")
    except Exception as e:
        logger.warning(f"Failed to create project: {e}")
        # Project is optional, continue without it

    # 5. Handle file uploads (store metadata for now)
    file_metadata: list[dict[str, Any]] = []
    message_content = prompt

    if files:
        for file in files:
            if file.filename:
                try:
                    # Read file content
                    content = await file.read()
                    file_size = len(content)

                    # Store file metadata
                    file_info = {
                        "filename": file.filename,
                        "size": file_size,
                        "content_type": file.content_type,
                    }
                    file_metadata.append(file_info)
                    logger.debug(f"Processed file: {file.filename} ({file_size} bytes)")

                    # TODO: Store actual file content to cloud storage or database
                    # For now, just add to message content
                    message_content += (
                        f"\n\n[File attached: {file.filename} ({file_size} bytes)]"
                    )

                except Exception as e:
                    logger.error(f"Error processing file {file.filename}: {str(e)}")
                    message_content += f"\n\n[Failed to process file: {file.filename}]"
                finally:
                    await file.close()

    # 6. Create Thread
    try:
        # Generate thread title from prompt
        thread_title = f"{prompt[:50]}..." if len(prompt) > 50 else prompt

        thread = Thread(
            title=thread_title,
            description=f"Conversation with agent{' ' + agent_data.name if agent_data else ''}",
            owner_id=current_user.id,
            project_id=project.id if project else None,
        )
        session.add(thread)
        session.flush()  # Get the thread ID without committing yet
        logger.info(f"Created new thread: {thread.id}")

        # 7. Add initial user message to thread
        message = ThreadMessage(
            content=message_content,
            role="user",
            thread_id=thread.id,
        )
        session.add(message)
        session.flush()
        logger.debug(f"Created initial message: {message.id}")

        # 8. Determine effective model
        effective_model = model_name
        if not model_name and agent_data and agent_data.model:
            effective_model = agent_data.model
            logger.debug(
                f"No model specified by user, using agent's configured model: {effective_model}"
            )
        elif model_name:
            logger.debug(f"Using user-selected model: {effective_model}")
        else:
            logger.debug(f"Using default model: {effective_model}")

        # 9. Create Agent Run
        agent_run_metadata: dict[str, Any] = {
            "model_name": effective_model,
            "user_prompt": prompt[:100],  # Store first 100 chars
            "project_id": str(project.id) if project else None,
        }

        if file_metadata:
            agent_run_metadata["files"] = file_metadata

        if agent_data and agent_data.system_prompt:
            agent_run_metadata["system_prompt_preview"] = agent_data.system_prompt[:100]

        agent_run = AgentRun(
            thread_id=thread.id,
            agent_id=agent_data.id if agent_data else None,
            agent_version_id=agent_data.current_version_id if agent_data else None,
            status=AgentRunStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
            my_metadata=agent_run_metadata,
        )
        session.add(agent_run)
        session.commit()
        session.refresh(agent_run)
        logger.debug(f"Created new agent run: {agent_run.id}")

        # 10. Register run in Redis for distributed tracking
        instance_key = f"active_run:agent:{agent_run.id}"
        try:
            await redis.set(instance_key, "running", ex=redis.REDIS_KEY_TTL)
            logger.debug(f"Registered agent run in Redis: {instance_key}")
        except Exception as e:
            logger.warning(
                f"Failed to register agent run in Redis ({instance_key}): {str(e)}"
            )

        # 11. Dispatch background task for agent execution
        from app.tasks.agent_tasks import execute_agent_run

        execute_agent_run.send(
            agent_run_id=str(agent_run.id),
            thread_id=str(thread.id),
            model_name=effective_model,
        )
        logger.info(f"Dispatched background task for agent run {agent_run.id}")

        return InitiateAgentResponse(
            thread_id=thread.id,
            agent_run_id=agent_run.id,
            message=f"Agent session initiated successfully. Thread: {thread.id}",
        )

    except Exception as e:
        session.rollback()
        logger.error(f"Error in agent initiation: {str(e)}", exc_info=True)

        # Cleanup: Delete created resources on failure
        try:
            if "thread" in locals() and thread:
                logger.debug(f"Cleaning up thread {thread.id} after failure")
                session.delete(thread)
            if "project" in locals() and project:
                logger.debug(f"Cleaning up project {project.id} after failure")
                session.delete(project)
            session.commit()
        except Exception as cleanup_error:
            logger.warning(f"Failed to cleanup after error: {cleanup_error}")

        raise HTTPException(
            status_code=500, detail=f"Failed to initiate agent session: {str(e)}"
        )


@router.get(
    "/agent-runs/active",
    response_model=dict[str, list],
    summary="List Active Agent Runs",
    operation_id="list_active_agent_runs",
)
async def get_active_agent_runs(
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, list]:
    """
    Get all active (running) agent runs for the current user.

    Returns agent runs across all threads owned by the user.
    """
    logger.debug(f"Fetching active agent runs for user: {current_user.id}")

    # Query running agent runs for user's agents
    statement = (
        select(AgentRun)
        .join(Agent, AgentRun.agent_id == Agent.user, isouter=True)
        .join(Thread, AgentRun.thread_id == Thread.id)
        .where(
            Thread.owner_id == current_user.id,
            AgentRun.status == AgentRunStatus.RUNNING,
        )
        .order_by(AgentRun.started_at.desc())
    )

    active_runs = session.exec(statement).all()

    logger.debug(
        f"Found {len(active_runs)} active agent runs for user: {current_user.id}"
    )

    return {
        "active_runs": [
            {
                "id": str(run.id),
                "thread_id": str(run.thread_id),
                "agent_id": str(run.agent_id) if run.agent_id else None,
                "status": run.status,
                "started_at": run.started_at.isoformat(),
            }
            for run in active_runs
        ]
    }


@router.get(
    "/threads/{thread_id}/agent-runs",
    response_model=dict[str, list],
    summary="List Thread Agent Runs",
    operation_id="list_thread_agent_runs",
)
async def get_thread_agent_runs(
    thread_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, list]:
    """Get all agent runs for a specific thread."""
    logger.debug(f"Fetching agent runs for thread: {thread_id}")

    # Verify thread access
    await verify_thread_access(session, thread_id, current_user)

    # Get agent runs for this thread
    statement = (
        select(AgentRun)
        .where(AgentRun.thread_id == thread_id)
        .order_by(AgentRun.created_at.desc())
    )

    agent_runs = session.exec(statement).all()

    logger.debug(f"Found {len(agent_runs)} agent runs for thread: {thread_id}")

    return {
        "agent_runs": [
            {
                "id": str(run.id),
                "thread_id": str(run.thread_id),
                "agent_id": str(run.agent_id) if run.agent_id else None,
                "status": run.status,
                "started_at": run.started_at.isoformat(),
                "completed_at": run.completed_at.isoformat()
                if run.completed_at
                else None,
                "error_message": run.error_message,
                "created_at": run.created_at.isoformat(),
                "updated_at": run.updated_at.isoformat(),
            }
            for run in agent_runs
        ]
    }


@router.get(
    "/agent-runs/{agent_run_id}",
    response_model=dict[str, Any],
    summary="Get Agent Run Status",
    operation_id="get_agent_run_status",
)
async def get_agent_run_status(
    agent_run_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """Get the status and details of an agent run."""
    logger.debug(f"Fetching agent run details: {agent_run_id}")

    # Get agent run with access check
    agent_run = await _get_agent_run_with_access_check(
        session, agent_run_id, current_user
    )

    return {
        "id": str(agent_run.id),
        "thread_id": str(agent_run.thread_id),
        "agent_id": str(agent_run.agent_id) if agent_run.agent_id else None,
        "status": agent_run.status,
        "started_at": agent_run.started_at.isoformat(),
        "completed_at": agent_run.completed_at.isoformat()
        if agent_run.completed_at
        else None,
        "error_message": agent_run.error_message,
        "my_metadata": agent_run.my_metadata,
    }


@router.post(
    "/agent-runs/{agent_run_id}/stop",
    response_model=dict[str, str],
    summary="Stop Agent Run",
    operation_id="stop_agent_run",
)
async def stop_agent(
    agent_run_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, str]:
    """
    Stop a running agent run.

    Only the thread owner or superuser can stop an agent run.
    """
    logger.debug(f"Received request to stop agent run: {agent_run_id}")

    # Get agent run with access check
    agent_run = await _get_agent_run_with_access_check(
        session, agent_run_id, current_user
    )

    # Stop the agent run using run manager
    if agent_run.status in [
        AgentRunStatus.COMPLETED,
        AgentRunStatus.FAILED,
        AgentRunStatus.CANCELLED,
    ]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot stop agent run with status: {agent_run.status}",
        )

    await stop_agent_run_with_helpers(session, agent_run_id)

    return {
        "status": "stopped",
        "agent_run_id": str(agent_run_id),
        "message": "Agent run stopped successfully",
    }


@router.post(
    "/agent-runs/{agent_run_id}/retry",
    response_model=dict[str, Any],
    summary="Retry Failed Agent Run",
    operation_id="retry_agent_run",
)
async def retry_agent(
    agent_run_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """
    Retry a failed agent run.

    Only the thread owner or superuser can retry an agent run.
    Only failed or cancelled runs can be retried.
    """
    logger.debug(f"Received request to retry agent run: {agent_run_id}")

    # Get agent run with access check
    agent_run = await _get_agent_run_with_access_check(
        session, agent_run_id, current_user
    )

    # Check if agent run can be retried
    if agent_run.status not in [AgentRunStatus.FAILED, AgentRunStatus.CANCELLED]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot retry agent run with status: {agent_run.status}. Only failed or cancelled runs can be retried.",
        )

    # Create new agent run (copy of the failed one)
    new_agent_run = AgentRun(
        thread_id=agent_run.thread_id,
        agent_id=agent_run.agent_id,
        agent_version_id=agent_run.agent_version_id,
        status=AgentRunStatus.RUNNING,
        started_at=datetime.now(timezone.utc),
        my_metadata={
            **(agent_run.my_metadata or {}),
            "retried_from": str(agent_run_id),
            "retry_attempt": (agent_run.my_metadata or {}).get("retry_attempt", 0) + 1,
        },
    )
    session.add(new_agent_run)
    session.commit()
    session.refresh(new_agent_run)

    logger.info(f"Created retry agent run: {new_agent_run.id} from {agent_run_id}")

    # Register in Redis
    instance_key = f"active_run:agent:{new_agent_run.id}"
    try:
        await redis.set(instance_key, "running", ex=redis.REDIS_KEY_TTL)
        logger.debug(f"Registered retry agent run in Redis: {instance_key}")
    except Exception as e:
        logger.warning(f"Failed to register in Redis: {e}")

    # Dispatch background task
    from app.tasks.agent_tasks import execute_agent_run

    model_name = (agent_run.my_metadata or {}).get("model_name", "gpt-4")
    execute_agent_run.send(
        agent_run_id=str(new_agent_run.id),
        thread_id=str(agent_run.thread_id),
        model_name=model_name,
    )
    logger.info(f"Dispatched retry background task for agent run {new_agent_run.id}")

    return {
        "original_run_id": str(agent_run_id),
        "new_run_id": str(new_agent_run.id),
        "status": "running",
        "message": "Agent run retried successfully",
    }
