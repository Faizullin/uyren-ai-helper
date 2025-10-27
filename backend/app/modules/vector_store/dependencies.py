"""Common dependencies and helper functions for vector store operations."""

import uuid

from fastapi import HTTPException

from app.core.db import SessionDep
from app.models import Project
from app.modules.vector_store.manager import vector_store_manager
from app.modules.vector_store.models import Page, VectorStore
from app.utils.authentication import CurrentUser


async def verify_project_exists(
    session: SessionDep, project_id: uuid.UUID, current_user: CurrentUser
) -> Project:
    """Verify project exists and user has access to it."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this project"
        )

    return project


async def verify_vector_store_ownership(
    session: SessionDep, vector_store_id: uuid.UUID, current_user: CurrentUser
) -> VectorStore:
    """Verify user owns the vector store."""
    vector_store = vector_store_manager.get_vector_store(
        session, vector_store_id, current_user.id
    )
    if not vector_store:
        raise HTTPException(status_code=404, detail="Vector store not found")

    return vector_store


async def verify_vector_store_access(
    session: SessionDep, vector_store_id: uuid.UUID, owner_id: uuid.UUID
) -> VectorStore:
    """Verify user has access to vector store (by owner_id)."""
    vector_store = vector_store_manager.get_vector_store(session, vector_store_id, owner_id)
    if not vector_store:
        raise HTTPException(status_code=404, detail="Vector store not found or access denied")
    return vector_store


async def verify_page_ownership(
    session: SessionDep, page_id: uuid.UUID, current_user: CurrentUser
) -> Page:
    """Verify user owns the page."""
    page = vector_store_manager.get_page(session, page_id, current_user.id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")

    return page

