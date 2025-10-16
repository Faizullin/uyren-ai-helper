"""Thread and Message routes."""

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import func, select

from app.core.db import SessionDep
from app.core.logger import logger
from app.crud import (
    create_thread_message,
    delete_thread_message,
    get_thread_message,
    update_thread_message,
)
from app.models import (
    AgentRun,
    Project,
    Thread,
    ThreadMessage,
    ThreadMessagePublic,
    ThreadMessagesPublic,
    ThreadPublic,
)
from app.modules.agents.authentication import verify_thread_access
from app.schemas import (
    Message,
    ThreadCreate,
    ThreadMessageCreate,
    ThreadMessageUpdate,
    ThreadUpdate,
)
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["threads"])


# ==================== Thread CRUD Operations ====================


def create_thread(
    session: SessionDep, thread_create: ThreadCreate, owner_id: uuid.UUID
) -> Thread:
    """Create new thread."""
    thread = Thread(
        title=thread_create.title,
        description=thread_create.description,
        owner_id=owner_id,
        project_id=thread_create.project_id
        if hasattr(thread_create, "project_id")
        else None,
    )
    session.add(thread)
    session.commit()
    session.refresh(thread)
    return thread


# ==================== Thread Endpoints ====================


@router.get("/threads", summary="List User Threads", operation_id="list_user_threads")
async def read_threads(
    session: SessionDep,
    current_user: CurrentUser,
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(100, ge=1, le=1000, description="Items per page (max 1000)"),
) -> dict[str, Any]:
    """
    Get all threads for current user with pagination and project data.

    Returns threads with:
    - Associated project information
    - Message count per thread
    - Pagination metadata
    """
    logger.debug(
        f"Fetching threads for user: {current_user.id} (page={page}, limit={limit})"
    )

    # Calculate offset
    offset = (page - 1) * limit

    # Build query based on permissions
    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Thread)
        threads_statement = (
            select(Thread)
            .offset(offset)
            .limit(limit)
            .order_by(Thread.updated_at.desc())
        )
    else:
        count_statement = (
            select(func.count())
            .select_from(Thread)
            .where(Thread.owner_id == current_user.id)
        )
        threads_statement = (
            select(Thread)
            .where(Thread.owner_id == current_user.id)
            .offset(offset)
            .limit(limit)
            .order_by(Thread.updated_at.desc())
        )

    # Get total count and threads
    total_count = session.exec(count_statement).one()
    threads = session.exec(threads_statement).all()

    # Get unique project IDs from threads
    project_ids = [thread.project_id for thread in threads if thread.project_id]
    unique_project_ids = list(set(project_ids))

    # Fetch projects in batch
    projects_by_id = {}
    if unique_project_ids:
        projects_statement = select(Project).where(Project.id.in_(unique_project_ids))
        projects = session.exec(projects_statement).all()
        projects_by_id = {project.id: project for project in projects}
        logger.debug(f"Retrieved {len(projects)} projects for threads")

    # Get message counts for threads
    message_counts = {}
    if threads:
        thread_ids = [thread.id for thread in threads]
        count_query = (
            select(ThreadMessage.thread_id, func.count(ThreadMessage.id))
            .where(ThreadMessage.thread_id.in_(thread_ids))
            .group_by(ThreadMessage.thread_id)
        )
        for thread_id, count in session.exec(count_query).all():
            message_counts[thread_id] = count

    # Map threads with project data and message counts
    mapped_threads = []
    for thread in threads:
        project_data = None
        if thread.project_id and thread.project_id in projects_by_id:
            project = projects_by_id[thread.project_id]
            project_data = {
                "id": str(project.id),
                "name": project.name,
                "description": project.description,
                "is_public": project.is_public,
                "created_at": project.created_at,
                "updated_at": project.updated_at,
            }

        mapped_thread = {
            "id": str(thread.id),
            "title": thread.title,
            "description": thread.description,
            "owner_id": str(thread.owner_id),
            "project_id": str(thread.project_id) if thread.project_id else None,
            "created_at": thread.created_at,
            "updated_at": thread.updated_at,
            "project": project_data,
            "message_count": message_counts.get(thread.id, 0),
        }
        mapped_threads.append(mapped_thread)

    # Calculate pagination metadata
    total_pages = (total_count + limit - 1) // limit if total_count else 0

    logger.debug(
        f"Returning {len(mapped_threads)} threads with {len(projects_by_id)} projects"
    )

    return {
        "threads": mapped_threads,
        "pagination": {
            "page": page,
            "limit": limit,
            "total": total_count,
            "pages": total_pages,
        },
    }


@router.get("/threads/{thread_id}", summary="Get Thread", operation_id="get_thread")
async def read_thread(
    thread_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, Any]:
    """
    Get a specific thread by ID with complete related data.

    Returns:
    - Thread details
    - Associated project data
    - Message count
    - Recent agent runs
    """
    logger.debug(f"Fetching thread: {thread_id}")

    # Verify access (allows public projects)
    thread = await verify_thread_access(session, thread_id, current_user)

    # Get associated project
    project_data = None
    if thread.project_id:
        project = session.get(Project, thread.project_id)
        if project:
            project_data = {
                "id": str(project.id),
                "name": project.name,
                "description": project.description,
                "is_public": project.is_public,
                "created_at": project.created_at,
                "updated_at": project.updated_at,
            }

    # Get message count
    message_count_query = (
        select(func.count())
        .select_from(ThreadMessage)
        .where(ThreadMessage.thread_id == thread_id)
    )
    message_count = session.exec(message_count_query).one()

    # Get recent agent runs
    agent_runs_query = (
        select(AgentRun)
        .where(AgentRun.thread_id == thread_id)
        .order_by(AgentRun.created_at.desc())
        .limit(10)
    )
    agent_runs = session.exec(agent_runs_query).all()

    agent_runs_data = [
        {
            "id": str(run.id),
            "status": run.status,
            "started_at": run.started_at,
            "completed_at": run.completed_at,
            "error_message": run.error_message,
            "agent_id": str(run.agent_id) if run.agent_id else None,
            "agent_version_id": str(run.agent_version_id)
            if run.agent_version_id
            else None,
            "created_at": run.created_at,
        }
        for run in agent_runs
    ]

    logger.debug(
        f"Thread {thread_id}: {message_count} messages, {len(agent_runs_data)} recent runs"
    )

    return {
        "id": str(thread.id),
        "title": thread.title,
        "description": thread.description,
        "owner_id": str(thread.owner_id),
        "project_id": str(thread.project_id) if thread.project_id else None,
        "created_at": thread.created_at,
        "updated_at": thread.updated_at,
        "project": project_data,
        "message_count": message_count,
        "recent_agent_runs": agent_runs_data,
    }


@router.post(
    "/threads",
    response_model=ThreadPublic,
    summary="Create Thread",
    operation_id="create_thread",
)
async def create_thread_endpoint(
    session: SessionDep,
    thread_in: ThreadCreate,
    current_user: CurrentUser,
) -> ThreadPublic:
    """
    Create new thread.

    Optionally associate with a project.
    """
    logger.debug(f"Creating new thread: {thread_in.title}")
    thread = create_thread(session, thread_in, current_user.id)
    return ThreadPublic.model_validate(thread)


@router.patch("/threads/{thread_id}", response_model=ThreadPublic)
async def update_thread_endpoint(
    thread_id: uuid.UUID,
    thread_in: ThreadUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> ThreadPublic:
    """Update thread."""
    # Verify access
    thread = await verify_thread_access(session, thread_id, current_user)

    update_data = thread_in.model_dump(exclude_unset=True)
    thread.sqlmodel_update(update_data)
    thread.updated_at = datetime.now(timezone.utc)
    session.add(thread)
    session.commit()
    session.refresh(thread)

    return ThreadPublic.model_validate(thread)


@router.delete("/threads/{thread_id}", response_model=Message)
async def delete_thread_endpoint(
    thread_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete thread and all associated messages."""
    # Verify access
    thread = await verify_thread_access(session, thread_id, current_user)

    session.delete(thread)
    session.commit()
    logger.debug(f"Deleted thread: {thread_id}")
    return Message(message="Thread deleted successfully")


# ==================== Message Endpoints ====================


@router.get(
    "/threads/{thread_id}/messages",
    summary="Get Thread Messages",
    operation_id="get_thread_messages",
)
async def read_messages(
    thread_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    order: str = Query("desc", description="Order by created_at: 'asc' or 'desc'"),
    limit: int = Query(1000, ge=1, le=1000, description="Max messages to return"),
) -> ThreadMessagesPublic:
    """
    Get all messages for a thread.

    Fetches messages in batches to avoid large queries.
    Returns up to 'limit' messages ordered by creation time.
    """
    logger.debug(
        f"Fetching messages for thread: {thread_id}, order={order}, limit={limit}"
    )

    # Verify access (read operation - allows public projects)
    await verify_thread_access(session, thread_id, current_user)

    # Build query with ordering
    messages_query = select(ThreadMessage).where(ThreadMessage.thread_id == thread_id)

    if order == "desc":
        messages_query = messages_query.order_by(ThreadMessage.created_at.desc())
    else:
        messages_query = messages_query.order_by(ThreadMessage.created_at.asc())

    messages_query = messages_query.limit(limit)

    # Execute query
    messages = session.exec(messages_query).all()

    # Get total count
    count_query = (
        select(func.count())
        .select_from(ThreadMessage)
        .where(ThreadMessage.thread_id == thread_id)
    )
    total_count = session.exec(count_query).one()

    logger.debug(f"Fetched {len(messages)} messages (total: {total_count})")

    return ThreadMessagesPublic(
        data=[ThreadMessagePublic.model_validate(msg) for msg in messages],
        count=total_count,
    )


@router.post(
    "/threads/{thread_id}/messages",
    response_model=ThreadMessagePublic,
    summary="Create Message",
    operation_id="create_thread_message",
)
async def create_message_endpoint(
    thread_id: uuid.UUID,
    session: SessionDep,
    message_in: ThreadMessageCreate,
    current_user: CurrentUser,
) -> ThreadMessagePublic:
    """Create new message in a thread."""
    logger.debug(f"Creating message in thread: {thread_id}")

    # Verify access
    thread = await verify_thread_access(session, thread_id, current_user)

    message = create_thread_message(session, message_in, thread_id)

    # Update thread's updated_at timestamp
    thread.updated_at = datetime.now(timezone.utc)
    session.add(thread)
    session.commit()

    return ThreadMessagePublic.model_validate(message)


@router.get(
    "/threads/{thread_id}/messages/{message_id}", response_model=ThreadMessagePublic
)
async def read_message(
    thread_id: uuid.UUID,
    message_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> ThreadMessagePublic:
    """Get specific message by ID."""
    # Verify access (read operation - allows public projects)
    await verify_thread_access(session, thread_id, current_user)

    message = get_thread_message(session, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.thread_id != thread_id:
        raise HTTPException(status_code=404, detail="Message not found in this thread")

    return ThreadMessagePublic.model_validate(message)


@router.patch(
    "/threads/{thread_id}/messages/{message_id}", response_model=ThreadMessagePublic
)
async def update_message_endpoint(
    thread_id: uuid.UUID,
    message_id: uuid.UUID,
    message_in: ThreadMessageUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> ThreadMessagePublic:
    """Update message."""
    # Verify access
    await verify_thread_access(session, thread_id, current_user)

    message = get_thread_message(session, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.thread_id != thread_id:
        raise HTTPException(status_code=404, detail="Message not found in this thread")

    message = update_thread_message(session, message, message_in)
    return ThreadMessagePublic.model_validate(message)


@router.delete("/threads/{thread_id}/messages/{message_id}", response_model=Message)
async def delete_message_endpoint(
    thread_id: uuid.UUID,
    message_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete message from thread."""
    # Verify access
    await verify_thread_access(session, thread_id, current_user)

    message = get_thread_message(session, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.thread_id != thread_id:
        raise HTTPException(status_code=404, detail="Message not found in this thread")

    delete_thread_message(session, message)
    logger.debug(f"Deleted message {message_id} from thread {thread_id}")
    return Message(message="Message deleted successfully")
