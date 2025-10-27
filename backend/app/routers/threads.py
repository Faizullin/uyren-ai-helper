"""Thread and Message routes."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import func, select

from app.core.db import SessionDep
from app.core.logger import logger
from app.models import (
    AgentRun,
    Thread,
    ThreadMessage,
)
from app.modules.agents.authentication import verify_thread_access
from app.schemas.common import (
    Message,
    PaginatedResponse,
    PaginationQueryParams,
    create_paginated_response,
    get_pagination_params,
    paginate_query,
)
from app.schemas.thread import (
    ThreadCreate,
    ThreadDetail,
    ThreadMessageCreate,
    ThreadMessagePublic,
    ThreadMessageUpdate,
    ThreadPublic,
    ThreadUpdate,
)
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["threads"])


# ==================== Thread Endpoints ====================


@router.get(
    "/threads",
    response_model=PaginatedResponse[ThreadPublic],
    tags=["threads"],
    summary="List User Threads",
    operation_id="list_user_threads",
)
async def list_threads(
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[ThreadPublic]:
    """Get all threads for current user with pagination."""
    logger.debug(f"Fetching threads for user: {current_user.id}")

    # Build query based on permissions
    if current_user.is_superuser:
        query = select(Thread).order_by(Thread.updated_at.desc())
        count_query = select(func.count()).select_from(Thread)
    else:
        query = (
            select(Thread)
            .where(Thread.owner_id == current_user.id)
            .order_by(Thread.updated_at.desc())
        )
        count_query = (
            select(func.count())
            .select_from(Thread)
            .where(Thread.owner_id == current_user.id)
        )

    # Execute pagination
    results, total = paginate_query(session, query, count_query, pagination)
    threads = [ThreadPublic.model_validate(thread) for thread in results]

    logger.debug(f"Found {len(threads)} threads (total: {total})")

    return create_paginated_response(threads, pagination, total)


@router.get(
    "/threads/{thread_id}",
    response_model=ThreadDetail,
    tags=["threads"],
    summary="Get Thread",
    operation_id="get_thread",
)
async def get_thread(
    thread_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> ThreadDetail:
    """Get a specific thread by ID."""
    logger.debug(f"Fetching thread: {thread_id}")

    # Verify access (allows public projects)
    thread = await verify_thread_access(session, thread_id, current_user)

    return ThreadDetail.model_validate(thread)


@router.post(
    "/threads",
    response_model=ThreadPublic,
    tags=["threads"],
    summary="Create Thread",
    operation_id="create_thread",
)
async def create_thread(
    session: SessionDep,
    thread_in: ThreadCreate,
    current_user: CurrentUser,
) -> ThreadPublic:
    """Create new thread."""
    logger.debug(f"Creating new thread: {thread_in.title}")

    thread = Thread(
        title=thread_in.title,
        description=thread_in.description,
        owner_id=current_user.id,
    )
    session.add(thread)
    session.commit()
    session.refresh(thread)

    return ThreadPublic.model_validate(thread)


@router.patch(
    "/threads/{thread_id}",
    response_model=ThreadPublic,
    tags=["threads"],
    summary="Update Thread",
    operation_id="update_thread",
)
async def update_thread(
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


@router.delete(
    "/threads/{thread_id}",
    response_model=Message,
    tags=["threads"],
    summary="Delete Thread",
    operation_id="delete_thread",
)
async def delete_thread(
    thread_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete thread with all associated agent runs and messages."""
    # Verify access
    thread = await verify_thread_access(session, thread_id, current_user)

    # Delete all agent runs
    agent_runs = session.exec(
        select(AgentRun).where(AgentRun.thread_id == thread_id)
    ).all()
    for run in agent_runs:
        session.delete(run)
    logger.debug(f"Deleted {len(agent_runs)} agent runs for thread {thread_id}")

    # Delete all messages
    messages = session.exec(
        select(ThreadMessage).where(ThreadMessage.thread_id == thread_id)
    ).all()
    for msg in messages:
        session.delete(msg)
    logger.debug(f"Deleted {len(messages)} messages for thread {thread_id}")

    # Delete thread
    session.delete(thread)
    session.commit()

    logger.info(f"Deleted thread {thread_id} with {len(agent_runs)} runs and {len(messages)} messages")
    return Message(message="Thread deleted successfully")


# ==================== Message Endpoints ====================


@router.get(
    "/threads/{thread_id}/messages",
    response_model=PaginatedResponse[ThreadMessagePublic],
    tags=["threads"],
    summary="Get Thread Messages",
    operation_id="get_thread_messages",
)
async def get_thread_messages(
    thread_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
    order: str = Query("desc", description="Order by created_at: 'asc' or 'desc'"),
) -> PaginatedResponse[ThreadMessagePublic]:
    """Get all messages for a thread with pagination."""
    logger.debug(f"Fetching messages for thread: {thread_id}, order={order}")

    # Verify access (read operation - allows public projects)
    await verify_thread_access(session, thread_id, current_user)

    # Build query with ordering
    query = select(ThreadMessage).where(ThreadMessage.thread_id == thread_id)
    count_query = (
        select(func.count())
        .select_from(ThreadMessage)
        .where(ThreadMessage.thread_id == thread_id)
    )

    if order == "desc":
        query = query.order_by(ThreadMessage.created_at.desc())
    else:
        query = query.order_by(ThreadMessage.created_at.asc())

    # Execute pagination
    results, total = paginate_query(session, query, count_query, pagination)
    messages = [ThreadMessagePublic.model_validate(msg) for msg in results]

    logger.debug(f"Found {len(messages)} messages (total: {total})")

    return create_paginated_response(messages, pagination, total)


@router.post(
    "/threads/{thread_id}/messages",
    response_model=ThreadMessagePublic,
    tags=["threads"],
    summary="Create Message",
    operation_id="create_thread_message",
)
async def create_message(
    thread_id: uuid.UUID,
    session: SessionDep,
    message_in: ThreadMessageCreate,
    current_user: CurrentUser,
) -> ThreadMessagePublic:
    """Create new message in a thread."""
    logger.debug(f"Creating message in thread: {thread_id}")

    # Verify access
    thread = await verify_thread_access(session, thread_id, current_user)

    # Create message
    message = ThreadMessage(
        content=message_in.content,
        role=message_in.role,
        data=message_in.data,
        thread_id=thread_id,
    )
    session.add(message)

    # Update thread's updated_at timestamp
    thread.updated_at = datetime.now(timezone.utc)
    session.add(thread)
    session.commit()
    session.refresh(message)

    return ThreadMessagePublic.model_validate(message)


@router.get(
    "/threads/{thread_id}/messages/{message_id}",
    response_model=ThreadMessagePublic,
    tags=["threads"],
    summary="Get Message",
    operation_id="get_thread_message",
)
async def get_message(
    thread_id: uuid.UUID,
    message_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> ThreadMessagePublic:
    """Get specific message by ID."""
    # Verify access (read operation - allows public projects)
    await verify_thread_access(session, thread_id, current_user)

    message = session.get(ThreadMessage, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.thread_id != thread_id:
        raise HTTPException(status_code=404, detail="Message not found in this thread")

    return ThreadMessagePublic.model_validate(message)


@router.patch(
    "/threads/{thread_id}/messages/{message_id}",
    response_model=ThreadMessagePublic,
    tags=["threads"],
    summary="Update Message",
    operation_id="update_thread_message",
)
async def update_message(
    thread_id: uuid.UUID,
    message_id: uuid.UUID,
    message_in: ThreadMessageUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> ThreadMessagePublic:
    """Update message."""
    # Verify access
    await verify_thread_access(session, thread_id, current_user)

    message = session.get(ThreadMessage, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.thread_id != thread_id:
        raise HTTPException(status_code=404, detail="Message not found in this thread")

    # Update message
    update_data = message_in.model_dump(exclude_unset=True)
    message.sqlmodel_update(update_data)
    session.add(message)
    session.commit()
    session.refresh(message)

    return ThreadMessagePublic.model_validate(message)


@router.delete(
    "/threads/{thread_id}/messages/{message_id}",
    response_model=Message,
    tags=["threads"],
    summary="Delete Message",
    operation_id="delete_thread_message",
)
async def delete_message(
    thread_id: uuid.UUID,
    message_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete message from thread."""
    # Verify access
    await verify_thread_access(session, thread_id, current_user)

    message = session.get(ThreadMessage, message_id)
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    if message.thread_id != thread_id:
        raise HTTPException(status_code=404, detail="Message not found in this thread")

    session.delete(message)
    session.commit()
    logger.debug(f"Deleted message {message_id} from thread {thread_id}")
    return Message(message="Message deleted successfully")
