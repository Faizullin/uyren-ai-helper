"""Agent run routes."""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlmodel import Session, func, select

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
from app.schemas.agent_run import (
    AgentRetryResponse,
    AgentRunPublic,
    AgentRunStatusResponse,
    AgentStartRequest,
    AgentStartResponse,
    AgentStopResponse,
    InitiateAgentResponse,
)
from app.schemas.common import (
    PaginatedResponse,
    PaginationQueryParams,
    create_paginated_response,
    get_pagination_params,
    paginate_query,
)
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


# ==================== Agent Run Endpoints ====================


@router.post(
    "/threads/{thread_id}/agent/start",
    response_model=AgentStartResponse,
    tags=["agent-runs"],
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
        # agent_tasks.execute_agent_run.send(
        #     agent_run_id=str(agent_run.id),
        #     thread_id=str(thread.id),
        #     model_name=effective_model,
        # )
        logger.info(f"Dispatched background task for agent run {agent_run.id}")

        return AgentStartResponse(
            agent_run_id=agent_run.id,
            thread_id=thread.id,
            project_id=thread.project_id,
            model_name=effective_model,
            agent_name=agent_data.name if agent_data else None,
            status="running",
        )


@router.post(
    "/agent/initiate",
    response_model=InitiateAgentResponse,
    tags=["agent-runs"],
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

    if model_name is None:
        # Use tier-based default model from registry
        model_name = await model_manager.get_default_model_for_user(
            user_id=current_user.id
        )
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
        # execute_agent_run.send(
        #     agent_run_id=str(agent_run.id),
        #     thread_id=str(thread.id),
        #     model_name=effective_model,
        # )
        logger.info(f"Dispatched background task for agent run {agent_run.id}")

        return InitiateAgentResponse(
            thread_id=thread.id,
            agent_run_id=agent_run.id,
            project_id=project.id if project else None,
            model_name=effective_model,
            agent_name=agent_data.name if agent_data else None,
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
    response_model=PaginatedResponse[AgentRunPublic],
    tags=["agent-runs"],
    summary="List Active Agent Runs",
    operation_id="list_active_agent_runs",
)
async def get_active_agent_runs(
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[AgentRunPublic]:
    """Get all active (running) agent runs for the current user."""
    logger.debug(f"Fetching active agent runs for user: {current_user.id}")

    # Build query
    query = (
        select(AgentRun)
        .join(Agent, AgentRun.agent_id == Agent.user, isouter=True)
        .join(Thread, AgentRun.thread_id == Thread.id)
        .where(
            Thread.owner_id == current_user.id,
            AgentRun.status == AgentRunStatus.RUNNING,
        )
        .order_by(AgentRun.started_at.desc())
    )

    count_query = (
        select(func.count())
        .select_from(AgentRun)
        .join(Agent, AgentRun.agent_id == Agent.user, isouter=True)
        .join(Thread, AgentRun.thread_id == Thread.id)
        .where(
            Thread.owner_id == current_user.id,
            AgentRun.status == AgentRunStatus.RUNNING,
        )
    )

    # Execute pagination
    results, total = paginate_query(session, query, count_query, pagination)
    agent_runs = [AgentRunPublic.model_validate(run) for run in results]

    logger.debug(f"Found {len(agent_runs)} active agent runs (total: {total})")

    return create_paginated_response(agent_runs, pagination, total)


@router.get(
    "/threads/{thread_id}/agent-runs",
    response_model=PaginatedResponse[AgentRunPublic],
    tags=["agent-runs"],
    summary="List Thread Agent Runs",
    operation_id="list_thread_agent_runs",
)
async def get_thread_agent_runs(
    thread_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[AgentRunPublic]:
    """Get all agent runs for a specific thread."""
    logger.debug(f"Fetching agent runs for thread: {thread_id}")

    # Verify thread access
    await verify_thread_access(session, thread_id, current_user)

    # Build query
    query = (
        select(AgentRun)
        .where(AgentRun.thread_id == thread_id)
        .order_by(AgentRun.created_at.desc())
    )

    count_query = (
        select(func.count())
        .select_from(AgentRun)
        .where(AgentRun.thread_id == thread_id)
    )

    # Execute pagination
    results, total = paginate_query(session, query, count_query, pagination)
    agent_runs = [AgentRunPublic.model_validate(run) for run in results]

    logger.debug(
        f"Found {len(agent_runs)} agent runs for thread: {thread_id} (total: {total})"
    )

    return create_paginated_response(agent_runs, pagination, total)


@router.get(
    "/agent-runs/{agent_run_id}",
    response_model=AgentRunStatusResponse,
    tags=["agent-runs"],
    summary="Get Agent Run Status",
    operation_id="get_agent_run_status",
)
async def get_agent_run_status(
    agent_run_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> AgentRunStatusResponse:
    """Get the status and details of an agent run."""
    logger.debug(f"Fetching agent run details: {agent_run_id}")

    # Get agent run with access check
    agent_run = await _get_agent_run_with_access_check(
        session, agent_run_id, current_user
    )

    return AgentRunStatusResponse.model_validate(agent_run)


@router.post(
    "/agent-runs/{agent_run_id}/stop",
    response_model=AgentStopResponse,
    tags=["agent-runs"],
    summary="Stop Agent Run",
    operation_id="stop_agent_run",
)
async def stop_agent(
    agent_run_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> AgentStopResponse:
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

    return AgentStopResponse(message="Agent run stopped successfully")


@router.post(
    "/agent-runs/{agent_run_id}/retry",
    response_model=AgentRetryResponse,
    tags=["agent-runs"],
    summary="Retry Failed Agent Run",
    operation_id="retry_agent_run",
)
async def retry_agent(
    agent_run_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> AgentRetryResponse:
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
    # model_name = (agent_run.my_metadata or {}).get("model_name", "gpt-4")
    # execute_agent_run.send(
    #     agent_run_id=str(new_agent_run.id),
    #     thread_id=str(agent_run.thread_id),
    #     model_name=model_name,
    # )
    logger.info(f"Dispatched retry background task for agent run {new_agent_run.id}")

    return AgentRetryResponse(message="Agent run retry initiated successfully")


@router.get(
    "/agent-run/{agent_run_id}/stream",
    summary="Stream Agent Run",
    operation_id="stream_agent_run",
)
async def stream_agent_run(
    agent_run_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> StreamingResponse:
    """
    Stream the responses of an agent run using Redis Lists and Pub/Sub.

    This endpoint provides real-time streaming of agent run updates using Server-Sent Events (SSE).
    It follows the same pattern as the backend_suna streaming implementation.
    """
    logger.debug(f"Starting stream for agent run: {agent_run_id}")

    # Get agent run with access check
    agent_run = await _get_agent_run_with_access_check(session, agent_run_id, current_user)

    # Redis keys for this agent run
    response_list_key = f"agent_run:{agent_run_id}:responses"
    response_channel = f"agent_run:{agent_run_id}:new_response"
    control_channel = f"agent_run:{agent_run_id}:control"

    async def stream_generator():
        logger.debug(
            f"Streaming responses for {agent_run_id} using Redis list {response_list_key} and channel {response_channel}"
        )
        last_processed_index = -1
        terminate_stream = False
        initial_yield_complete = False
        listener_task = None

        try:
            # 1. Fetch and yield initial responses from Redis list
            redis_client = await redis.get_client()
            initial_responses_json = await redis_client.lrange(response_list_key, 0, -1)
            initial_responses = []
            if initial_responses_json:
                initial_responses = [json.loads(r) for r in initial_responses_json]
                logger.debug(f"Sending {len(initial_responses)} initial responses for {agent_run_id}")
                for response in initial_responses:
                    yield f"data: {json.dumps(response)}\n\n"
                last_processed_index = len(initial_responses) - 1
            initial_yield_complete = True

            # 2. Check run status
            current_status = agent_run.status

            if current_status != AgentRunStatus.RUNNING:
                logger.debug(f"Agent run {agent_run_id} is not running (status: {current_status}). Ending stream.")
                yield f"data: {json.dumps({'type': 'status', 'status': 'completed'})}\n\n"
                return

            # 3. Use Pub/Sub for live updates
            pubsub = redis_client.pubsub()
            await pubsub.subscribe(response_channel, control_channel)
            logger.debug(f"Subscribed to channels: {response_channel}, {control_channel}")

            # Queue to communicate between listeners and the main generator loop
            message_queue = asyncio.Queue()

            async def listen_messages():
                listener = pubsub.listen()
                task = asyncio.create_task(listener.__anext__())

                while not terminate_stream:
                    done, _ = await asyncio.wait([task], return_when=asyncio.FIRST_COMPLETED)
                    for finished in done:
                        try:
                            message = finished.result()
                            if message and isinstance(message, dict) and message.get("type") == "message":
                                channel = message.get("channel")
                                data = message.get("data")
                                if isinstance(data, bytes):
                                    data = data.decode('utf-8')

                                if channel == response_channel and data == "new":
                                    await message_queue.put({"type": "new_response"})
                                elif channel == control_channel and data in ["STOP", "END_STREAM", "ERROR"]:
                                    logger.debug(f"Received control signal '{data}' for {agent_run_id}")
                                    await message_queue.put({"type": "control", "data": data})
                                    return  # Stop listening on control signal

                        except StopAsyncIteration:
                            logger.warning(f"Listener stopped for {agent_run_id}.")
                            await message_queue.put({"type": "error", "data": "Listener stopped unexpectedly"})
                            return
                        except Exception as e:
                            logger.error(f"Error in listener for {agent_run_id}: {e}")
                            await message_queue.put({"type": "error", "data": "Listener failed"})
                            return
                        finally:
                            # Resubscribe to the next message if continuing
                            if not terminate_stream:
                                task = asyncio.create_task(listener.__anext__())

            listener_task = asyncio.create_task(listen_messages())

            # 4. Main loop to process messages from the queue
            while not terminate_stream:
                try:
                    queue_item = await message_queue.get()

                    if queue_item["type"] == "new_response":
                        # Fetch new responses from Redis list starting after the last processed index
                        new_start_index = last_processed_index + 1
                        new_responses_json = await redis_client.lrange(response_list_key, new_start_index, -1)

                        if new_responses_json:
                            new_responses = [json.loads(r) for r in new_responses_json]
                            num_new = len(new_responses)
                            for response in new_responses:
                                yield f"data: {json.dumps(response)}\n\n"
                                # Check if this response signals completion
                                if response.get('type') == 'status' and response.get('status') in ['completed', 'failed', 'stopped']:
                                    logger.debug(f"Detected run completion via status message in stream: {response.get('status')}")
                                    terminate_stream = True
                                    break  # Stop processing further new responses
                            last_processed_index += num_new
                        if terminate_stream:
                            break

                    elif queue_item["type"] == "control":
                        control_signal = queue_item["data"]
                        terminate_stream = True  # Stop the stream on any control signal
                        yield f"data: {json.dumps({'type': 'status', 'status': control_signal})}\n\n"
                        break

                    elif queue_item["type"] == "error":
                        logger.error(f"Listener error for {agent_run_id}: {queue_item['data']}")
                        terminate_stream = True
                        yield f"data: {json.dumps({'type': 'status', 'status': 'error'})}\n\n"
                        break

                except asyncio.CancelledError:
                    logger.debug(f"Stream generator main loop cancelled for {agent_run_id}")
                    terminate_stream = True
                    break
                except Exception as loop_err:
                    logger.error(f"Error in stream generator main loop for {agent_run_id}: {loop_err}", exc_info=True)
                    terminate_stream = True
                    yield f"data: {json.dumps({'type': 'status', 'status': 'error', 'message': f'Stream failed: {loop_err}'})}\n\n"
                    break

        except Exception as e:
            logger.error(f"Error setting up stream for agent run {agent_run_id}: {e}", exc_info=True)
            # Only yield error if initial yield didn't happen
            if not initial_yield_complete:
                yield f"data: {json.dumps({'type': 'status', 'status': 'error', 'message': f'Failed to start stream: {e}'})}\n\n"
        finally:
            terminate_stream = True
            # Graceful shutdown order: unsubscribe → close → cancel
            try:
                if 'pubsub' in locals() and pubsub:
                    await pubsub.unsubscribe(response_channel, control_channel)
                    await pubsub.close()
            except Exception as e:
                logger.debug(f"Error during pubsub cleanup for {agent_run_id}: {e}")

            if listener_task:
                listener_task.cancel()
                try:
                    await listener_task  # Reap inner tasks & swallow their errors
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.debug(f"listener_task ended with: {e}")
            # Wait briefly for tasks to cancel
            await asyncio.sleep(0.1)
            logger.debug(f"Streaming cleanup complete for agent run: {agent_run_id}")

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Content-Type": "text/event-stream",
            "Access-Control-Allow-Origin": "*"
        }
    )
