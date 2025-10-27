"""Vector Store API routes for VectorStore, Page, and PageSection."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, select

from app.core.db import SessionDep
from app.core.logger import logger
from app.modules.vector_store.dependencies import (
    verify_page_ownership,
    verify_project_exists,
    verify_vector_store_ownership,
)
from app.modules.vector_store.manager import vector_store_manager
from app.modules.vector_store.models import Page, VectorStore
from app.modules.vector_store.rag import embedding_service, kb_integration
from app.modules.vector_store.rag.search_providers import get_search_provider
from app.modules.vector_store.schemas import (
    PageChunkRequest,
    PageChunkResponse,
    PageCreate,
    PagePublic,
    PageSectionCreate,
    PageSectionPublic,
    PageSectionUpdate,
    PageSectionWithSimilarity,
    PageUpdate,
    SearchRequest,
    SearchResponse,
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

router = APIRouter()


# ==================== VectorStore CRUD Endpoints ====================


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
    await verify_project_exists(session, project_id, current_user)

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
    vector_store = await verify_vector_store_ownership(session, vector_store_id, current_user)
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
    await verify_project_exists(session, project_id, current_user)

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
    await verify_vector_store_ownership(session, vector_store_id, current_user)

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
    await verify_vector_store_ownership(session, vector_store_id, current_user)

    success = vector_store_manager.delete_vector_store(
        session, vector_store_id, current_user.id
    )

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete vector store")

    logger.info(f"Deleted vector store {vector_store_id}")
    return Message(message="Vector store deleted successfully")


# ==================== Page CRUD Endpoints ====================


@router.get(
    "/vector-stores/{vector_store_id}/pages",
    response_model=PaginatedResponse[PagePublic],
    summary="List Pages",
    operation_id="list_pages",
)
async def list_pages(
    vector_store_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
) -> PaginatedResponse[PagePublic]:
    """List all pages in a vector store."""
    await verify_vector_store_ownership(session, vector_store_id, current_user)

    query = select(Page).where(
        Page.vector_store_id == vector_store_id,
        Page.owner_id == current_user.id,
    )

    if target_type:
        query = query.where(Page.target_type == target_type)
    if target_id:
        query = query.where(Page.target_id == target_id)

    count_query = (
        select(func.count())
        .select_from(Page)
        .where(
            Page.vector_store_id == vector_store_id,
            Page.owner_id == current_user.id,
        )
    )

    if target_type:
        count_query = count_query.where(Page.target_type == target_type)
    if target_id:
        count_query = count_query.where(Page.target_id == target_id)

    query = query.order_by(Page.created_at.desc())
    results, total = paginate_query(session, query, count_query, pagination)

    pages = [PagePublic.model_validate(page) for page in results]
    return create_paginated_response(pages, pagination, total)


@router.get(
    "/pages/{page_id}",
    response_model=PagePublic,
    summary="Get Page",
    operation_id="get_page",
)
async def get_page(
    page_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> PagePublic:
    """Get a specific page by ID."""
    page = await verify_page_ownership(session, page_id, current_user)
    return PagePublic.model_validate(page)


@router.get(
    "/vector-stores/{vector_store_id}/pages/by-path",
    response_model=PagePublic,
    summary="Get Page by Path",
    operation_id="get_page_by_path",
)
async def get_page_by_path(
    vector_store_id: uuid.UUID,
    path: str,
    session: SessionDep,
    current_user: CurrentUser,
) -> PagePublic:
    """Get a page by its unique path (like chatbot's read by ID)."""
    await verify_vector_store_ownership(session, vector_store_id, current_user)

    page = vector_store_manager.get_page_by_path(session, path, vector_store_id)
    if not page:
        raise HTTPException(status_code=404, detail=f"Page not found at path: {path}")

    # Verify ownership
    if page.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return PagePublic.model_validate(page)


@router.post(
    "/vector-stores/{vector_store_id}/pages",
    response_model=PagePublic,
    summary="Create Page",
    operation_id="create_page",
)
async def create_page(
    vector_store_id: uuid.UUID,
    page_data: PageCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> PagePublic:
    """Create a new page in a vector store."""
    await verify_vector_store_ownership(session, vector_store_id, current_user)

    page = vector_store_manager.create_page(
        session=session,
        vector_store_id=vector_store_id,
        owner_id=current_user.id,
        path=page_data.path,
        content=page_data.content,
        meta=page_data.meta,
        target_type=page_data.target_type,
        target_id=page_data.target_id,
        source=page_data.source,
        parent_page_id=page_data.parent_page_id,
    )

    logger.info(f"Created page {page.id} in vector store {vector_store_id}")
    return PagePublic.model_validate(page)


@router.put(
    "/pages/{page_id}",
    response_model=PagePublic,
    summary="Update Page",
    operation_id="update_page",
)
async def update_page(
    page_id: uuid.UUID,
    page_data: PageUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> PagePublic:
    """Update an existing page."""
    await verify_page_ownership(session, page_id, current_user)

    update_data = page_data.model_dump(exclude_unset=True)
    updated_page = vector_store_manager.update_page(
        session=session,
        page_id=page_id,
        owner_id=current_user.id,
        **update_data,
    )

    if not updated_page:
        raise HTTPException(status_code=500, detail="Failed to update page")

    logger.info(f"Updated page {page_id}")
    return PagePublic.model_validate(updated_page)


@router.delete(
    "/pages/{page_id}",
    response_model=Message,
    summary="Delete Page",
    operation_id="delete_page",
)
async def delete_page(
    page_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete a page and all its sections."""
    await verify_page_ownership(session, page_id, current_user)

    success = vector_store_manager.delete_page(session, page_id, current_user.id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete page")

    logger.info(f"Deleted page {page_id}")
    return Message(message="Page deleted successfully")


# ==================== PageSection CRUD Endpoints ====================


@router.get(
    "/pages/{page_id}/sections",
    response_model=list[PageSectionPublic],
    summary="List Page Sections",
    operation_id="list_page_sections",
)
async def list_page_sections(
    page_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> list[PageSectionPublic]:
    """List all sections for a page."""
    await verify_page_ownership(session, page_id, current_user)

    sections = vector_store_manager.list_page_sections(session, page_id)
    return [PageSectionPublic.model_validate(section) for section in sections]


@router.get(
    "/sections/{section_id}",
    response_model=PageSectionPublic,
    summary="Get Page Section",
    operation_id="get_page_section",
)
async def get_page_section(
    section_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> PageSectionPublic:
    """Get a specific page section by ID."""
    section = vector_store_manager.get_page_section(session, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Page section not found")

    # Verify ownership through page
    page = vector_store_manager.get_page(session, section.page_id, current_user.id)
    if not page:
        raise HTTPException(status_code=403, detail="Not authorized")

    return PageSectionPublic.model_validate(section)


@router.post(
    "/pages/{page_id}/sections",
    response_model=PageSectionPublic,
    summary="Create Page Section",
    operation_id="create_page_section",
)
async def create_page_section(
    page_id: uuid.UUID,
    section_data: PageSectionCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> PageSectionPublic:
    """Create a new page section."""
    await verify_page_ownership(session, page_id, current_user)

    section = vector_store_manager.create_page_section(
        session=session,
        page_id=page_id,
        content=section_data.content,
        heading=section_data.heading,
        slug=section_data.slug,
    )

    logger.info(f"Created section {section.id} for page {page_id}")
    return PageSectionPublic.model_validate(section)


@router.put(
    "/sections/{section_id}",
    response_model=PageSectionPublic,
    summary="Update Page Section",
    operation_id="update_page_section",
)
async def update_page_section(
    section_id: uuid.UUID,
    section_data: PageSectionUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> PageSectionPublic:
    """Update an existing page section."""
    section = vector_store_manager.get_page_section(session, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Page section not found")

    # Verify ownership through page
    page = vector_store_manager.get_page(session, section.page_id, current_user.id)
    if not page:
        raise HTTPException(status_code=403, detail="Not authorized")

    # Update fields
    update_data = section_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(section, field):
            setattr(section, field, value)

    from datetime import datetime, timezone

    section.updated_at = datetime.now(timezone.utc)

    session.add(section)
    session.commit()
    session.refresh(section)

    logger.info(f"Updated section {section_id}")
    return PageSectionPublic.model_validate(section)


@router.delete(
    "/sections/{section_id}",
    response_model=Message,
    summary="Delete Page Section",
    operation_id="delete_page_section",
)
async def delete_page_section(
    section_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete a page section."""
    section = vector_store_manager.get_page_section(session, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Page section not found")

    # Verify ownership through page
    page = vector_store_manager.get_page(session, section.page_id, current_user.id)
    if not page:
        raise HTTPException(status_code=403, detail="Not authorized")

    success = vector_store_manager.delete_page_section(session, section_id)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete page section")

    logger.info(f"Deleted section {section_id}")
    return Message(message="Page section deleted successfully")


# ==================== Advanced Read Operations ====================


@router.get(
    "/pages/{page_id}/with-sections",
    response_model=dict,
    summary="Get Page with All Sections",
    operation_id="get_page_with_sections",
)
async def get_page_with_sections(
    page_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict:
    """Get page and all its sections in one call (like chatbot's /read/all)."""
    page = await verify_page_ownership(session, page_id, current_user)
    sections = vector_store_manager.list_page_sections(session, page_id)

    return {
        "page": PagePublic.model_validate(page),
        "sections": [PageSectionPublic.model_validate(s) for s in sections],
        "section_count": len(sections),
    }


# ==================== Bulk Operations ====================


@router.post(
    "/vector-stores/{vector_store_id}/pages/batch",
    response_model=dict,
    summary="Batch Create Pages",
    operation_id="batch_create_pages",
)
async def batch_create_pages(
    vector_store_id: uuid.UUID,
    pages_data: list[PageCreate],
    session: SessionDep,
    current_user: CurrentUser,
    auto_chunk: bool = True,
) -> dict:
    """Create multiple pages at once (like chatbot's /ingest with list)."""
    await verify_vector_store_ownership(session, vector_store_id, current_user)

    created_pages = []
    total_sections = 0

    for page_data in pages_data:
        # Create page
        page = vector_store_manager.create_page(
            session=session,
            vector_store_id=vector_store_id,
            owner_id=current_user.id,
            path=page_data.path,
            content=page_data.content,
            meta=page_data.meta,
            target_type=page_data.target_type,
            target_id=page_data.target_id,
            source=page_data.source,
            parent_page_id=page_data.parent_page_id,
        )

        # Auto-chunk content if provided and auto_chunk is True
        if auto_chunk and page_data.content:
            sections = vector_store_manager.chunk_content_to_sections(
                session=session,
                page_id=page.id,
                content=page_data.content,
            )
            total_sections += len(sections)

        created_pages.append(page)

    logger.info(
        f"Batch created {len(created_pages)} pages with {total_sections} sections"
    )

    return {
        "message": f"Successfully created {len(created_pages)} pages",
        "pages_created": len(created_pages),
        "sections_created": total_sections,
        "pages": [PagePublic.model_validate(p) for p in created_pages],
    }


@router.post(
    "/pages/{page_id}/chunk",
    response_model=PageChunkResponse,
    summary="Chunk Page Content",
    operation_id="chunk_page_content",
)
async def chunk_page_content(
    page_id: uuid.UUID,
    chunk_request: PageChunkRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> PageChunkResponse:
    """Chunk page content into sections automatically."""
    await verify_page_ownership(session, page_id, current_user)

    sections = vector_store_manager.chunk_content_to_sections(
        session=session,
        page_id=page_id,
        content=chunk_request.content,
        chunk_size=chunk_request.chunk_size,
        chunk_overlap=chunk_request.chunk_overlap,
    )

    logger.info(f"Chunked content into {len(sections)} sections for page {page_id}")

    return PageChunkResponse(
        page_id=page_id,
        sections_created=len(sections),
        sections=[PageSectionPublic.model_validate(s) for s in sections],
    )


# ==================== Knowledge Base Integration ====================


@router.post(
    "/vector-stores/{vector_store_id}/add-kb-file",
    response_model=dict,
    summary="Add Knowledge Base File",
    operation_id="add_kb_file_to_vector_store",
)
async def add_kb_file_to_vector_store(
    vector_store_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    kb_entry_id: uuid.UUID,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
) -> dict:
    """
    Add knowledge base file to vector store.

    File must be uploaded to KB first, then reference it here by kb_entry_id.
    """
    await verify_vector_store_ownership(session, vector_store_id, current_user)

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


# ==================== Semantic Search ====================


@router.post(
    "/vector-stores/{vector_store_id}/search",
    response_model=SearchResponse,
    summary="Semantic Search Page Sections",
    operation_id="search_page_sections",
)
async def search_page_sections(
    vector_store_id: uuid.UUID,
    search_request: SearchRequest,
    session: SessionDep,
    current_user: CurrentUser,
    provider: str = "pgvector",
) -> SearchResponse:
    """
    Semantic search using vector embeddings.

    Providers:
    - pgvector: Direct PostgreSQL pgvector search (default, good for small-medium datasets)
    - faiss: FAISS in-memory search (fast for large datasets, loads fresh index)

    Requires embeddings to be generated first via embedding service.

    Note: No owner_id filtering - searches across all data in vector store.
    """
    await verify_vector_store_ownership(session, vector_store_id, current_user)

    # Generate query embedding
    try:
        query_embedding = await embedding_service.generate_embedding(search_request.query)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Get search provider
    try:
        search_provider = get_search_provider(provider)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Perform search using selected provider
    try:
        results = await search_provider.search(
            session=session,
            vector_store_id=vector_store_id,
            query_embedding=query_embedding,
            top_k=search_request.top_k,
            similarity_threshold=search_request.similarity_threshold,
            target_type=search_request.target_type,
            target_id=search_request.target_id,
        )

        # Format results
        search_results = []
        for result in results:
            search_results.append(
                PageSectionWithSimilarity(
                    id=uuid.UUID(result["id"]),
                    page_id=uuid.UUID(result["page_id"]),
                    content=result["content"],
                    heading=result["heading"],
                    slug=result["slug"],
                    similarity=result["similarity"],
                )
            )

        logger.info(
            f"Search query '{search_request.query}' using {provider} returned {len(search_results)} results"
        )

        return SearchResponse(
            query=search_request.query,
            results=search_results,
            results_count=len(search_results),
            vector_store_id=vector_store_id,
        )

    except Exception as e:
        logger.error(f"Error in {provider} search: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
