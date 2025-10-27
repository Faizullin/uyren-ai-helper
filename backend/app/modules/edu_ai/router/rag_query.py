"""RAG Query router for Educational AI module - Minimal and clean."""

import uuid

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import select

from app.core.db import SessionDep
from app.core.logger import logger
from app.modules.edu_ai.utils import check_api_key_access
from app.modules.vector_store.dependencies import verify_vector_store_access
from app.modules.vector_store.manager import vector_store_manager
from app.modules.vector_store.models import Page, PageSection
from app.modules.vector_store.rag import kb_integration
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["rag-query"])


# ==================== Helper Functions ====================


async def validate_api_key_access(session: SessionDep, api_key: str | None) -> None:
    """Validate API key if provided."""
    if api_key:
        has_access = check_api_key_access(session, api_key)
        if not has_access:
            raise HTTPException(status_code=403, detail="Invalid API key")


# ==================== Vector Store Management ====================


@router.post(
    "/edu-ai/vector-store/create",
    response_model=dict,
    summary="Create Vector Store for RAG",
    operation_id="create_vector_store_for_rag",
)
async def create_vector_store_for_rag(
    session: SessionDep,
    current_user: CurrentUser,
    name: str = Query(..., description="Vector store name"),
    description: str | None = Query(None, description="Optional description"),
    project_id: uuid.UUID | None = Query(None, description="Optional project ID"),
    api_key: str | None = Query(None, description="Optional API key"),
) -> dict:
    """Create a new vector store for RAG operations."""
    await validate_api_key_access(session, api_key)

    try:
        vector_store = vector_store_manager.create_vector_store(
            session=session,
            owner_id=current_user.id,
            name=name,
            project_id=project_id,
            description=description,
        )

        logger.info(f"Created vector store {vector_store.id} for RAG")

        return {
            "status": "success",
            "vector_store_id": str(vector_store.id),
            "name": vector_store.name,
            "message": "Vector store created successfully",
        }

    except Exception as e:
        logger.error(f"Error creating vector store: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create vector store: {str(e)}")


# ==================== Knowledge Base Integration ====================


@router.post(
    "/edu-ai/vector-store/{vector_store_id}/add-kb-entry",
    response_model=dict,
    summary="Add Knowledge Base Entry to Vector Store",
    operation_id="add_kb_entry_to_vector_store",
)
async def add_kb_entry_to_vector_store(
    vector_store_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    kb_entry_id: uuid.UUID = Query(..., description="Knowledge base entry ID"),
    target_type: str | None = Query(None, description="Target type (course, lesson)"),
    target_id: uuid.UUID | None = Query(None, description="Target ID"),
) -> dict:
    """Add a knowledge base entry to vector store."""
    await verify_vector_store_access(session, vector_store_id, current_user.id)

    result = await kb_integration.process_kb_entry_for_rag(
        session=session,
        kb_entry_id=kb_entry_id,
        vector_store_id=vector_store_id,
        owner_id=current_user.id,
        target_type=target_type,
        target_id=target_id,
    )

    if result["status"] != "success":
        raise HTTPException(status_code=500, detail=result["message"])

    return result


@router.post(
    "/edu-ai/vector-store/{vector_store_id}/add-kb-folder",
    response_model=dict,
    summary="Add All KB Files from Folder",
    operation_id="add_kb_folder_to_vector_store",
)
async def add_kb_folder_to_vector_store(
    vector_store_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    folder_id: uuid.UUID = Query(..., description="Knowledge base folder ID"),
    target_type: str | None = Query(None, description="Target type (course, lesson)"),
    target_id: uuid.UUID | None = Query(None, description="Target ID"),
) -> dict:
    """Bulk process all files in a knowledge base folder."""
    await verify_vector_store_access(session, vector_store_id, current_user.id)

    result = await kb_integration.bulk_process_kb_folder(
        session=session,
        folder_id=folder_id,
        vector_store_id=vector_store_id,
        owner_id=current_user.id,
        target_type=target_type,
        target_id=target_id,
    )

    logger.info(f"Bulk processed folder {folder_id} to vector store {vector_store_id}")
    return result


# ==================== Statistics ====================


@router.get(
    "/edu-ai/vector-store/{vector_store_id}/stats",
    response_model=dict,
    summary="Get Vector Store Statistics",
    operation_id="get_vector_store_stats",
)
async def get_vector_store_stats(
    vector_store_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict:
    """Get statistics for a vector store."""
    await verify_vector_store_access(session, vector_store_id, current_user.id)

    try:
        # Get vector store
        vector_store = vector_store_manager.get_vector_store(
            session, vector_store_id, current_user.id
        )

        if not vector_store:
            raise HTTPException(status_code=404, detail="Vector store not found")

        # Get page count
        page_count = session.exec(
            select(Page).where(
                Page.vector_store_id == vector_store_id,
                Page.owner_id == current_user.id,
            )
        ).count()

        # Get section count
        section_count = session.exec(
            select(PageSection)
            .join(Page)
            .where(
                Page.vector_store_id == vector_store_id,
                Page.owner_id == current_user.id,
            )
        ).count()

        return {
            "status": "success",
            "vector_store_id": str(vector_store.id),
            "name": vector_store.name,
            "page_count": page_count,
            "section_count": section_count,
            "created_at": vector_store.created_at.isoformat(),
            "updated_at": vector_store.updated_at.isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting vector store stats: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


