"""ThreadMessage CRUD operations."""

import uuid
from datetime import datetime, timezone

from sqlmodel import Session, func, select

from app.models.thread import (
    Thread,
    ThreadMessage,
    ThreadMessagePublic,
    ThreadMessagesPublic,
)
from app.schemas.message import ThreadMessageCreate, ThreadMessageUpdate


def create_thread_message(session: Session, message_create: ThreadMessageCreate, thread_id: uuid.UUID) -> ThreadMessage:
    """Create new message in a thread."""
    message = ThreadMessage(
        content=message_create.content,
        role=message_create.role,
        thread_id=thread_id,
    )
    session.add(message)

    # Update thread's updated_at timestamp
    thread = session.get(Thread, thread_id)
    if thread:
        thread.updated_at = datetime.now(timezone.utc)
        session.add(thread)

    session.commit()
    session.refresh(message)
    return message


def get_thread_message(session: Session, message_id: uuid.UUID) -> ThreadMessage | None:
    """Get message by ID."""
    return session.get(ThreadMessage, message_id)


def get_thread_messages(
    session: Session, thread_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> ThreadMessagesPublic:
    """Get messages for a thread with pagination."""
    count_statement = select(func.count()).select_from(ThreadMessage).where(ThreadMessage.thread_id == thread_id)
    statement = (
        select(ThreadMessage)
        .where(ThreadMessage.thread_id == thread_id)
        .offset(skip)
        .limit(limit)
        .order_by(ThreadMessage.created_at.asc())
    )

    count = session.exec(count_statement).one()
    messages = session.exec(statement).all()

    return ThreadMessagesPublic(
        data=[ThreadMessagePublic.model_validate(message) for message in messages],
        count=count,
    )


def update_thread_message(session: Session, message: ThreadMessage, message_update: ThreadMessageUpdate) -> ThreadMessage:
    """Update message."""
    update_data = message_update.model_dump(exclude_unset=True)
    message.sqlmodel_update(update_data)
    session.add(message)
    session.commit()
    session.refresh(message)
    return message


def delete_thread_message(session: Session, message: ThreadMessage) -> None:
    """Delete message."""
    session.delete(message)
    session.commit()

