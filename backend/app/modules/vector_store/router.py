"""Vector Store API routes."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, select

from app.core.db import SessionDep
from app.core.logger import logger
from app.models import Project
from app.modules.vector_store.manager import vector_store_manager
from app.modules.vector_store.models import Document, VectorStore
from app.modules.vector_store.schemas import (
    DocumentCreate,
    DocumentPublic,
    DocumentUpdate,
    VectorStoreCreate,
    VectorStorePublic,
    VectorStoreUpdate,
)
from app.schemas.common import (
    Message,
    PaginatedResponse,
    PaginationQueryParams,
    create_paginated_response,
    get_pagination_params,
    paginate_query,
)
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["vector-stores"])


# ==================== Helper Functions ====================


def verify_project_exists(
    session: SessionDep, project_id: uuid.UUID, current_user: CurrentUser
) -> Project:
    """Verify project exists and user has access to it."""

    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check ownership
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this project"
        )

    return project


def verify_vector_store_ownership(
    session: SessionDep, vector_store_id: uuid.UUID, current_user: CurrentUser
) -> VectorStore:
    """Verify user owns the vector store."""
    vector_store = vector_store_manager.get_vector_store(
        session, vector_store_id, current_user.id
    )
    if not vector_store:
        raise HTTPException(status_code=404, detail="Vector store not found")

    return vector_store


def verify_document_ownership(
    session: SessionDep, document_id: uuid.UUID, current_user: CurrentUser
) -> Document:
    """Verify user owns the document."""
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if document.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this document"
        )

    return document


# ==================== Vector Store CRUD Endpoints ====================


@router.get(
    "/projects/{project_id}/vector-stores",
    response_model=PaginatedResponse[VectorStorePublic],
    summary="List Project Vector Stores",
    operation_id="list_project_vector_stores",
)
async def list_project_vector_stores(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[VectorStorePublic]:
    """List all vector stores for a specific project."""
    # Verify project exists and user has access
    verify_project_exists(session, project_id, current_user)

    query = select(VectorStore).where(
        VectorStore.owner_id == current_user.id, VectorStore.project_id == project_id
    )
    count_query = (
        select(func.count())
        .select_from(VectorStore)
        .where(
            VectorStore.owner_id == current_user.id,
            VectorStore.project_id == project_id,
        )
    )

    query = query.order_by(VectorStore.created_at.desc())

    results, total = paginate_query(session, query, count_query, pagination)

    # Convert to public schemas
    vector_stores = [VectorStorePublic.model_validate(vs) for vs in results]

    return create_paginated_response(vector_stores, pagination, total)


@router.get(
    "/vector-stores/{vector_store_id}",
    response_model=VectorStorePublic,
    summary="Get Vector Store",
    operation_id="get_vector_store",
)
async def get_vector_store(
    vector_store_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> VectorStorePublic:
    """Get a specific vector store by ID."""
    vector_store = verify_vector_store_ownership(session, vector_store_id, current_user)
    return VectorStorePublic.model_validate(vector_store)


@router.post(
    "/projects/{project_id}/vector-stores",
    response_model=VectorStorePublic,
    summary="Create Vector Store",
    operation_id="create_vector_store",
)
async def create_vector_store(
    project_id: uuid.UUID,
    vector_store_data: VectorStoreCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> VectorStorePublic:
    """Create a new vector store for a project."""
    # Verify project exists and user has access
    verify_project_exists(session, project_id, current_user)

    # Create vector store
    vector_store = vector_store_manager.create_vector_store(
        session=session,
        owner_id=current_user.id,
        project_id=project_id,
        name=vector_store_data.name,
        description=vector_store_data.description,
    )

    logger.info(f"Created vector store {vector_store.id} for project {project_id}")

    return VectorStorePublic.model_validate(vector_store)


@router.put(
    "/vector-stores/{vector_store_id}",
    response_model=VectorStorePublic,
    summary="Update Vector Store",
    operation_id="update_vector_store",
)
async def update_vector_store(
    vector_store_id: uuid.UUID,
    vector_store_data: VectorStoreUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> VectorStorePublic:
    """Update an existing vector store."""
    verify_vector_store_ownership(session, vector_store_id, current_user)

    # Update fields
    update_data = vector_store_data.model_dump(exclude_unset=True)

    updated_vector_store = vector_store_manager.update_vector_store(
        session=session,
        vector_store_id=vector_store_id,
        owner_id=current_user.id,
        **update_data,
    )

    if not updated_vector_store:
        raise HTTPException(status_code=500, detail="Failed to update vector store")

    logger.info(f"Updated vector store {vector_store_id}")

    return VectorStorePublic.model_validate(updated_vector_store)


@router.delete(
    "/vector-stores/{vector_store_id}",
    response_model=Message,
    summary="Delete Vector Store",
    operation_id="delete_vector_store",
)
async def delete_vector_store(
    vector_store_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete a vector store."""
    verify_vector_store_ownership(session, vector_store_id, current_user)

    success = vector_store_manager.delete_vector_store(
        session, vector_store_id, current_user.id
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete vector store")

    logger.info(f"Deleted vector store {vector_store_id}")

    return Message(message="Vector store deleted successfully")


# ==================== Document CRUD Endpoints ====================


@router.get(
    "/vector-stores/{vector_store_id}/documents",
    response_model=PaginatedResponse[DocumentPublic],
    summary="List Vector Store Documents",
    operation_id="list_vector_store_documents",
)
async def list_vector_store_documents(
    vector_store_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[DocumentPublic]:
    """List all documents in a vector store."""
    # Verify vector store ownership
    verify_vector_store_ownership(session, vector_store_id, current_user)

    query = select(Document).where(
        Document.vector_store_id == vector_store_id,
        Document.owner_id == current_user.id,
    )
    count_query = (
        select(func.count())
        .select_from(Document)
        .where(
            Document.vector_store_id == vector_store_id,
            Document.owner_id == current_user.id,
        )
    )

    query = query.order_by(Document.created_at.desc())

    results, total = paginate_query(session, query, count_query, pagination)

    # Convert to public schemas
    documents = [DocumentPublic.model_validate(doc) for doc in results]

    return create_paginated_response(documents, pagination, total)


@router.get(
    "/documents/{document_id}",
    response_model=DocumentPublic,
    summary="Get Document",
    operation_id="get_document",
)
async def get_document(
    document_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> DocumentPublic:
    """Get a specific document by ID."""
    document = verify_document_ownership(session, document_id, current_user)
    return DocumentPublic.model_validate(document)


@router.post(
    "/vector-stores/{vector_store_id}/documents",
    response_model=DocumentPublic,
    summary="Add Document to Vector Store",
    operation_id="add_document_to_vector_store",
)
async def add_document_to_vector_store(
    vector_store_id: uuid.UUID,
    document_data: DocumentCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> DocumentPublic:
    """Add a document to a vector store."""
    # Verify vector store ownership
    verify_vector_store_ownership(session, vector_store_id, current_user)

    # Add document
    document = vector_store_manager.add_document(
        session=session,
        vector_store_id=vector_store_id,
        owner_id=current_user.id,
        title=document_data.title,
        content=document_data.content,
        content_type=document_data.content_type,
        source_url=document_data.source_url,
        source_file_path=document_data.source_file_path,
        target_type=document_data.target_type,
        target_id=document_data.target_id,
    )

    if not document:
        raise HTTPException(status_code=500, detail="Failed to add document")

    logger.info(f"Added document {document.id} to vector store {vector_store_id}")

    return DocumentPublic.model_validate(document)


@router.post(
    "/vector-stores/{vector_store_id}/documents/course/{course_id}",
    response_model=DocumentPublic,
    summary="Add Course Document",
    operation_id="add_course_document",
)
async def add_course_document(
    vector_store_id: uuid.UUID,
    course_id: uuid.UUID,
    document_data: DocumentCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> DocumentPublic:
    """Add a document for a specific course."""
    # Verify vector store ownership
    verify_vector_store_ownership(session, vector_store_id, current_user)

    # Add course document
    document = vector_store_manager.add_course_document(
        session=session,
        vector_store_id=vector_store_id,
        owner_id=current_user.id,
        course_id=course_id,
        title=document_data.title,
        content=document_data.content,
        content_type=document_data.content_type,
        source_url=document_data.source_url,
        source_file_path=document_data.source_file_path,
    )

    if not document:
        raise HTTPException(status_code=500, detail="Failed to add course document")

    logger.info(f"Added course document {document.id} for course {course_id}")

    return DocumentPublic.model_validate(document)


@router.post(
    "/vector-stores/{vector_store_id}/documents/lesson/{lesson_id}",
    response_model=DocumentPublic,
    summary="Add Lesson Document",
    operation_id="add_lesson_document",
)
async def add_lesson_document(
    vector_store_id: uuid.UUID,
    lesson_id: uuid.UUID,
    document_data: DocumentCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> DocumentPublic:
    """Add a document for a specific lesson."""
    # Verify vector store ownership
    verify_vector_store_ownership(session, vector_store_id, current_user)

    # Add lesson document
    document = vector_store_manager.add_lesson_document(
        session=session,
        vector_store_id=vector_store_id,
        owner_id=current_user.id,
        lesson_id=lesson_id,
        title=document_data.title,
        content=document_data.content,
        content_type=document_data.content_type,
        source_url=document_data.source_url,
        source_file_path=document_data.source_file_path,
    )

    if not document:
        raise HTTPException(status_code=500, detail="Failed to add lesson document")

    logger.info(f"Added lesson document {document.id} for lesson {lesson_id}")

    return DocumentPublic.model_validate(document)


@router.put(
    "/documents/{document_id}",
    response_model=DocumentPublic,
    summary="Update Document",
    operation_id="update_document",
)
async def update_document(
    document_id: uuid.UUID,
    document_data: DocumentUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> DocumentPublic:
    """Update an existing document."""
    document = verify_document_ownership(session, document_id, current_user)

    # Update fields
    update_data = document_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(document, key, value)

    document.updated_at = datetime.now(timezone.utc)

    session.add(document)
    session.commit()
    session.refresh(document)

    logger.info(f"Updated document {document_id}")

    return DocumentPublic.model_validate(document)


@router.delete(
    "/documents/{document_id}",
    response_model=Message,
    summary="Delete Document",
    operation_id="delete_document",
)
async def delete_document(
    document_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete a document."""
    document = verify_document_ownership(session, document_id, current_user)

    session.delete(document)
    session.commit()

    logger.info(f"Deleted document {document_id}")

    return Message(message="Document deleted successfully")


# ==================== Target-Specific Document Endpoints ====================


@router.get(
    "/courses/{course_id}/documents",
    response_model=PaginatedResponse[DocumentPublic],
    summary="Get Course Documents",
    operation_id="get_course_documents",
)
async def get_course_documents(
    course_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[DocumentPublic]:
    """Get all documents for a specific course."""
    # Get course documents
    documents = vector_store_manager.get_course_documents(
        session=session,
        course_id=course_id,
        owner_id=current_user.id,
    )

    # Apply pagination
    total = len(documents)
    start = pagination.offset
    end = start + pagination.limit
    paginated_documents = documents[start:end]

    # Convert to public schemas
    document_publics = [
        DocumentPublic.model_validate(doc) for doc in paginated_documents
    ]

    return create_paginated_response(document_publics, pagination, total)


@router.get(
    "/lessons/{lesson_id}/documents",
    response_model=PaginatedResponse[DocumentPublic],
    summary="Get Lesson Documents",
    operation_id="get_lesson_documents",
)
async def get_lesson_documents(
    lesson_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[DocumentPublic]:
    """Get all documents for a specific lesson."""
    # Get lesson documents
    documents = vector_store_manager.get_lesson_documents(
        session=session,
        lesson_id=lesson_id,
        owner_id=current_user.id,
    )

    # Apply pagination
    total = len(documents)
    start = pagination.offset
    end = start + pagination.limit
    paginated_documents = documents[start:end]

    # Convert to public schemas
    document_publics = [
        DocumentPublic.model_validate(doc) for doc in paginated_documents
    ]

    return create_paginated_response(document_publics, pagination, total)
