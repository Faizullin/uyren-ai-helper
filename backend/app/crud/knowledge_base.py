"""Knowledge Base CRUD operations."""

import uuid
from datetime import datetime, timezone

from sqlmodel import Session, func, select

from app.models.knowledge_base import (
    AgentKnowledgeAssignment,
    KnowledgeBaseEntry,
    KnowledgeBaseFolder,
)
from app.schemas.knowledge_base import (
    KnowledgeBaseEntryUpdate,
    KnowledgeBaseFolderCreate,
    KnowledgeBaseFolderUpdate,
)


# ==================== Folder CRUD ====================


def get_folder_by_id(
    session: Session, folder_id: uuid.UUID, owner_id: uuid.UUID
) -> KnowledgeBaseFolder | None:
    """Get folder by ID with ownership check."""
    statement = select(KnowledgeBaseFolder).where(
        KnowledgeBaseFolder.id == folder_id, KnowledgeBaseFolder.owner_id == owner_id
    )
    return session.exec(statement).first()


def get_folders(
    session: Session, owner_id: uuid.UUID, skip: int = 0, limit: int = 100
) -> list[KnowledgeBaseFolder]:
    """Get all folders for a user."""
    statement = (
        select(KnowledgeBaseFolder)
        .where(KnowledgeBaseFolder.owner_id == owner_id)
        .order_by(KnowledgeBaseFolder.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def get_folder_entry_count(session: Session, folder_id: uuid.UUID) -> int:
    """Get count of active entries in a folder."""
    statement = (
        select(func.count())
        .select_from(KnowledgeBaseEntry)
        .where(
            KnowledgeBaseEntry.folder_id == folder_id,
            KnowledgeBaseEntry.is_active == True,
        )
    )
    return session.exec(statement).one()


def get_existing_folder_names(session: Session, owner_id: uuid.UUID) -> list[str]:
    """Get all existing folder names for a user."""
    statement = select(KnowledgeBaseFolder.name).where(
        KnowledgeBaseFolder.owner_id == owner_id
    )
    return list(session.exec(statement).all())


def create_folder(
    session: Session, folder_in: KnowledgeBaseFolderCreate, owner_id: uuid.UUID
) -> KnowledgeBaseFolder:
    """Create a new knowledge base folder."""
    folder = KnowledgeBaseFolder(
        name=folder_in.name,
        description=folder_in.description,
        owner_id=owner_id,
    )
    session.add(folder)
    session.commit()
    session.refresh(folder)
    return folder


def update_folder(
    session: Session,
    folder: KnowledgeBaseFolder,
    folder_in: KnowledgeBaseFolderUpdate,
) -> KnowledgeBaseFolder:
    """Update a knowledge base folder."""
    update_data = folder_in.model_dump(exclude_unset=True)
    folder.sqlmodel_update(update_data)
    folder.updated_at = datetime.now(timezone.utc)
    session.add(folder)
    session.commit()
    session.refresh(folder)
    return folder


def delete_folder(session: Session, folder: KnowledgeBaseFolder) -> None:
    """Delete a knowledge base folder (cascade deletes entries)."""
    session.delete(folder)
    session.commit()


# ==================== Entry CRUD ====================


def get_entry_by_id(
    session: Session, entry_id: uuid.UUID, owner_id: uuid.UUID
) -> KnowledgeBaseEntry | None:
    """Get entry by ID with ownership check."""
    statement = select(KnowledgeBaseEntry).where(
        KnowledgeBaseEntry.id == entry_id, KnowledgeBaseEntry.owner_id == owner_id
    )
    return session.exec(statement).first()


def get_folder_entries(
    session: Session,
    folder_id: uuid.UUID,
    owner_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> list[KnowledgeBaseEntry]:
    """Get all entries in a folder."""
    statement = (
        select(KnowledgeBaseEntry)
        .where(
            KnowledgeBaseEntry.folder_id == folder_id,
            KnowledgeBaseEntry.owner_id == owner_id,
            KnowledgeBaseEntry.is_active == True,
        )
        .order_by(KnowledgeBaseEntry.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(statement).all())


def get_existing_filenames_in_folder(
    session: Session, folder_id: uuid.UUID
) -> list[str]:
    """Get all existing filenames in a folder."""
    statement = select(KnowledgeBaseEntry.filename).where(
        KnowledgeBaseEntry.folder_id == folder_id, KnowledgeBaseEntry.is_active == True
    )
    return list(session.exec(statement).all())


def get_total_file_size_for_user(session: Session, owner_id: uuid.UUID) -> int:
    """Get total file size for all active entries for a user."""
    statement = select(func.sum(KnowledgeBaseEntry.file_size)).where(
        KnowledgeBaseEntry.owner_id == owner_id, KnowledgeBaseEntry.is_active == True
    )
    result = session.exec(statement).one()
    return result if result is not None else 0


def create_entry(
    session: Session,
    folder_id: uuid.UUID,
    owner_id: uuid.UUID,
    filename: str,
    file_path: str,
    file_size: int,
    mime_type: str,
    summary: str,
) -> KnowledgeBaseEntry:
    """Create a new knowledge base entry."""
    entry = KnowledgeBaseEntry(
        folder_id=folder_id,
        owner_id=owner_id,
        filename=filename,
        file_path=file_path,
        file_size=file_size,
        mime_type=mime_type,
        summary=summary,
        is_active=True,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def update_entry(
    session: Session, entry: KnowledgeBaseEntry, entry_in: KnowledgeBaseEntryUpdate
) -> KnowledgeBaseEntry:
    """Update a knowledge base entry."""
    update_data = entry_in.model_dump(exclude_unset=True)
    entry.sqlmodel_update(update_data)
    entry.updated_at = datetime.now(timezone.utc)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def move_entry(
    session: Session, entry: KnowledgeBaseEntry, target_folder_id: uuid.UUID, new_file_path: str
) -> KnowledgeBaseEntry:
    """Move an entry to a different folder."""
    entry.folder_id = target_folder_id
    entry.file_path = new_file_path
    entry.updated_at = datetime.now(timezone.utc)
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry


def delete_entry(session: Session, entry: KnowledgeBaseEntry) -> None:
    """Delete a knowledge base entry."""
    session.delete(entry)
    session.commit()


# ==================== Agent Assignment CRUD ====================


def get_agent_assignments(
    session: Session, agent_id: uuid.UUID
) -> dict[uuid.UUID, bool]:
    """Get all knowledge base assignments for an agent."""
    statement = select(AgentKnowledgeAssignment).where(
        AgentKnowledgeAssignment.agent_id == agent_id
    )
    assignments = session.exec(statement).all()
    return {assignment.entry_id: assignment.enabled for assignment in assignments}


def clear_agent_assignments(session: Session, agent_id: uuid.UUID) -> None:
    """Clear all assignments for an agent."""
    statement = select(AgentKnowledgeAssignment).where(
        AgentKnowledgeAssignment.agent_id == agent_id
    )
    assignments = session.exec(statement).all()
    for assignment in assignments:
        session.delete(assignment)
    session.commit()


def create_agent_assignment(
    session: Session, agent_id: uuid.UUID, entry_id: uuid.UUID, owner_id: uuid.UUID
) -> AgentKnowledgeAssignment:
    """Create an agent knowledge assignment."""
    assignment = AgentKnowledgeAssignment(
        agent_id=agent_id,
        entry_id=entry_id,
        owner_id=owner_id,
        enabled=True,
    )
    session.add(assignment)
    session.commit()
    session.refresh(assignment)
    return assignment


def get_agent_enabled_entries(
    session: Session, agent_id: uuid.UUID
) -> list[KnowledgeBaseEntry]:
    """Get all enabled knowledge base entries for an agent."""
    statement = (
        select(KnowledgeBaseEntry)
        .join(AgentKnowledgeAssignment)
        .where(
            AgentKnowledgeAssignment.agent_id == agent_id,
            AgentKnowledgeAssignment.enabled == True,
            KnowledgeBaseEntry.is_active == True,
        )
    )
    return list(session.exec(statement).all())

