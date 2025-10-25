"""RAG Query router for Educational AI module."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select

from app.core.db import SessionDep
from app.core.logger import logger
from app.modules.edu_ai.tools.supabase_faiss import supabase_faiss_tool
from app.modules.vector_store.models import VectorStore
from app.schemas.common import Message
from app.utils.authentication import CurrentUser

router = APIRouter(prefix="/rag-query", tags=["rag-query"])


@router.post(
    "/search",
    response_model=dict,
    summary="Search Educational Content",
    operation_id="search_educational_content",
)
async def search_educational_content(
    session: SessionDep,
    current_user: CurrentUser,
    query_text: str = Query(..., description="Search query text"),
    vector_store_id: uuid.UUID = Query(..., description="Vector store ID to search"),
    similarity_threshold: float = Query(0.7, description="Minimum similarity threshold (0.0-1.0)"),
    max_results: int = Query(10, description="Maximum number of results to return"),
    target_type: str | None = Query(None, description="Filter by target type (course, lesson, etc.)"),
    target_id: uuid.UUID | None = Query(None, description="Filter by target ID"),
    api_key: str | None = Query(None, description="Optional API key for access control"),
) -> dict:
    """
    Search educational content using RAG (Retrieval-Augmented Generation) with vector similarity.
    
    Args:
        query_text: The text to search for
        vector_store_id: Vector store to search in
        similarity_threshold: Minimum similarity score (0.0-1.0)
        max_results: Maximum number of results
        target_type: Optional filter by target type
        target_id: Optional filter by target ID
        api_key: Optional API key for access control
        
    Returns:
        Search results with similarity scores and metadata
    """
    try:
        # Verify vector store exists and user has access
        query = select(VectorStore).where(
            VectorStore.id == vector_store_id,
            VectorStore.owner_id == current_user.id
        )
        vector_store = session.exec(query).first()

        if not vector_store:
            raise HTTPException(status_code=404, detail="Vector store not found or access denied")

        # Search using Supabase FAISS tool
        result = await supabase_faiss_tool.search_similar_content(
            session=session,
            vector_store_id=vector_store_id,
            query_text=query_text,
            owner_id=current_user.id,
            similarity_threshold=similarity_threshold,
            max_results=max_results,
            target_type=target_type,
            target_id=target_id,
            api_key=api_key,
        )

        if result["status"] != "success":
            raise HTTPException(status_code=500, detail=result["message"])

        logger.info(f"RAG search completed for user {current_user.id} with {result['results_count']} results")

        return {
            "status": "success",
            "query": query_text,
            "vector_store_id": str(vector_store_id),
            "results_count": result["results_count"],
            "results": result["results"],
            "search_metadata": {
                "similarity_threshold": similarity_threshold,
                "max_results": max_results,
                "target_type": target_type,
                "target_id": str(target_id) if target_id else None,
            }
        }

    except Exception as e:
        logger.error(f"Error in RAG search for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.post(
    "/vector-store/create",
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
    api_key: str | None = Query(None, description="Optional API key for access control"),
) -> dict:
    """
    Create a new vector store for RAG operations.
    
    Args:
        name: Vector store name
        description: Optional description
        project_id: Optional project ID
        api_key: Optional API key for access control
        
    Returns:
        Created vector store information
    """
    try:
        # Create vector store using Supabase FAISS tool
        result = await supabase_faiss_tool.create_vector_store(
            session=session,
            owner_id=current_user.id,
            name=name,
            project_id=project_id,
            description=description,
            api_key=api_key,
        )

        if result["status"] != "success":
            raise HTTPException(status_code=500, detail=result["message"])

        logger.info(f"Created vector store {result['vector_store_id']} for RAG operations")

        return result

    except Exception as e:
        logger.error(f"Error creating vector store for RAG: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to create vector store: {str(e)}")


@router.post(
    "/vector-store/{vector_store_id}/add-knowledge-base",
    response_model=dict,
    summary="Add Knowledge Base Entry to Vector Store",
    operation_id="add_knowledge_base_to_vector_store",
)
async def add_knowledge_base_to_vector_store(
    vector_store_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    knowledge_base_entry_id: uuid.UUID = Query(..., description="Knowledge base entry ID"),
    target_type: str | None = Query(None, description="Optional target type (course, lesson, etc.)"),
    target_id: uuid.UUID | None = Query(None, description="Optional target ID"),
    api_key: str | None = Query(None, description="Optional API key for access control"),
) -> dict:
    """
    Add a knowledge base entry to vector store for RAG operations.
    
    Args:
        vector_store_id: Vector store ID
        knowledge_base_entry_id: Knowledge base entry ID to add
        target_type: Optional target type
        target_id: Optional target ID
        api_key: Optional API key for access control
        
    Returns:
        Operation result
    """
    try:
        # Add knowledge base entry using Supabase FAISS tool
        result = await supabase_faiss_tool.add_knowledge_base_document(
            session=session,
            vector_store_id=vector_store_id,
            knowledge_base_entry_id=knowledge_base_entry_id,
            owner_id=current_user.id,
            target_type=target_type,
            target_id=target_id,
            api_key=api_key,
        )

        if result["status"] != "success":
            raise HTTPException(status_code=500, detail=result["message"])

        logger.info(f"Added knowledge base entry {knowledge_base_entry_id} to vector store {vector_store_id}")

        return result

    except Exception as e:
        logger.error(f"Error adding knowledge base entry to vector store: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to add knowledge base entry: {str(e)}")


@router.get(
    "/vector-store/{vector_store_id}/stats",
    response_model=dict,
    summary="Get Vector Store Statistics",
    operation_id="get_vector_store_stats_for_rag",
)
async def get_vector_store_stats_for_rag(
    vector_store_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    api_key: str | None = Query(None, description="Optional API key for access control"),
) -> dict:
    """
    Get statistics for a vector store used in RAG operations.
    
    Args:
        vector_store_id: Vector store ID
        api_key: Optional API key for access control
        
    Returns:
        Vector store statistics
    """
    try:
        # Get stats using Supabase FAISS tool
        result = await supabase_faiss_tool.get_vector_store_stats(
            session=session,
            vector_store_id=vector_store_id,
            owner_id=current_user.id,
            api_key=api_key,
        )

        if result["status"] != "success":
            raise HTTPException(status_code=500, detail=result["message"])

        return result

    except Exception as e:
        logger.error(f"Error getting vector store stats for RAG: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get vector store stats: {str(e)}")


@router.post(
    "/query-with-context",
    response_model=dict,
    summary="Query with RAG Context",
    operation_id="query_with_rag_context",
)
async def query_with_rag_context(
    session: SessionDep,
    current_user: CurrentUser,
    query_text: str = Query(..., description="Query text"),
    vector_store_id: uuid.UUID = Query(..., description="Vector store ID"),
    context_limit: int = Query(5, description="Number of context documents to retrieve"),
    similarity_threshold: float = Query(0.7, description="Minimum similarity threshold"),
    api_key: str | None = Query(None, description="Optional API key for access control"),
) -> dict:
    """
    Perform a query with RAG context retrieval.
    
    This endpoint retrieves relevant context from the vector store and returns it
    along with the original query for use in generative AI applications.
    
    Args:
        query_text: The query text
        vector_store_id: Vector store to search for context
        context_limit: Number of relevant documents to retrieve as context
        similarity_threshold: Minimum similarity threshold for context retrieval
        api_key: Optional API key for access control
        
    Returns:
        Query with retrieved context for RAG applications
    """
    try:
        # Verify vector store exists and user has access
        query = select(VectorStore).where(
            VectorStore.id == vector_store_id,
            VectorStore.owner_id == current_user.id
        )
        vector_store = session.exec(query).first()

        if not vector_store:
            raise HTTPException(status_code=404, detail="Vector store not found or access denied")

        # Search for relevant context
        search_result = await supabase_faiss_tool.search_similar_content(
            session=session,
            vector_store_id=vector_store_id,
            query_text=query_text,
            owner_id=current_user.id,
            similarity_threshold=similarity_threshold,
            max_results=context_limit,
            api_key=api_key,
        )

        if search_result["status"] != "success":
            raise HTTPException(status_code=500, detail=search_result["message"])

        # Format context for RAG
        context_documents = []
        for result in search_result["results"]:
            context_documents.append({
                "document_id": result["document_id"],
                "title": result["title"],
                "similarity": result["similarity"],
                "target_type": result["target_type"],
                "target_id": result["target_id"],
            })

        logger.info(f"RAG context query completed for user {current_user.id} with {len(context_documents)} context documents")

        return {
            "status": "success",
            "query": query_text,
            "vector_store_id": str(vector_store_id),
            "context_documents": context_documents,
            "context_metadata": {
                "context_limit": context_limit,
                "similarity_threshold": similarity_threshold,
                "total_context_documents": len(context_documents),
            },
            "usage": {
                "query_tokens": len(query_text.split()),  # Rough estimate
                "context_tokens": sum(len(doc["title"].split()) for doc in context_documents),
            }
        }

    except Exception as e:
        logger.error(f"Error in RAG context query for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"RAG context query failed: {str(e)}")
