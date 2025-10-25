"""
Supabase FAISS Tool for Educational AI
Handles vector operations using Supabase with FAISS integration
"""

import uuid
from typing import Any

from app.core.logger import logger
from app.modules.edu_ai.utils import validate_api_key, check_api_key_access
from app.modules.vector_store.manager import vector_store_manager
from app.modules.vector_store.models import VectorStore, Document
from app.models.knowledge_base import KnowledgeBaseEntry
from sqlmodel import select, Session


class SupabaseFAISSTool:
    """Tool for handling Supabase FAISS operations in educational AI context."""

    def __init__(self):
        self.name = "supabase_faiss_tool"
        self.description = "Vector search and embedding operations using Supabase with FAISS"

    async def create_vector_store(
        self,
        session: Session,
        owner_id: uuid.UUID,
        name: str,
        project_id: uuid.UUID | None = None,
        description: str | None = None,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """
        Create a new vector store for educational content.
        
        Args:
            session: Database session
            owner_id: User ID
            name: Vector store name
            project_id: Optional project ID
            description: Optional description
            api_key: Optional API key for validation
            
        Returns:
            Dictionary with operation result
        """
        try:
            # Validate API key if provided
            if api_key:
                has_access = check_api_key_access(session, api_key, str(project_id) if project_id else None)
                if not has_access:
                    return {
                        "status": "error",
                        "message": "Invalid API key or insufficient permissions"
                    }

            # Create vector store using existing logic
            vector_store = vector_store_manager.create_vector_store(
                session=session,
                owner_id=owner_id,
                name=name,
                project_id=project_id,
                description=description,
            )

            logger.info(f"Created vector store {vector_store.id} for educational AI")

            return {
                "status": "success",
                "vector_store_id": str(vector_store.id),
                "name": vector_store.name,
                "message": "Vector store created successfully"
            }

        except Exception as e:
            logger.error(f"Error creating vector store: {e}")
            return {
                "status": "error",
                "message": f"Failed to create vector store: {str(e)}"
            }

    async def add_knowledge_base_document(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        knowledge_base_entry_id: uuid.UUID,
        owner_id: uuid.UUID,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """
        Add a knowledge base entry to vector store for embedding.
        
        Args:
            session: Database session
            vector_store_id: Vector store ID
            knowledge_base_entry_id: Knowledge base entry ID
            owner_id: User ID
            target_type: Optional target type (course, lesson, etc.)
            target_id: Optional target ID
            api_key: Optional API key for validation
            
        Returns:
            Dictionary with operation result
        """
        try:
            # Validate API key if provided
            if api_key:
                has_access = check_api_key_access(session, api_key)
                if not has_access:
                    return {
                        "status": "error",
                        "message": "Invalid API key or insufficient permissions"
                    }

            # Verify knowledge base entry exists
            kb_entry = session.exec(
                select(KnowledgeBaseEntry).where(
                    KnowledgeBaseEntry.id == knowledge_base_entry_id,
                    KnowledgeBaseEntry.owner_id == owner_id,
                    KnowledgeBaseEntry.is_active == True
                )
            ).first()

            if not kb_entry:
                return {
                    "status": "error",
                    "message": "Knowledge base entry not found or inactive"
                }

            # Create document reference
            document = vector_store_manager.add_document(
                session=session,
                vector_store_id=vector_store_id,
                owner_id=owner_id,
                title=kb_entry.filename,
                content="",  # Content comes from knowledge base entry
                content_type=kb_entry.mime_type,
                source_file_path=kb_entry.file_path,
                target_type=target_type,
                target_id=target_id,
            )

            if not document:
                return {
                    "status": "error",
                    "message": "Failed to add document to vector store"
                }

            logger.info(f"Added knowledge base entry {knowledge_base_entry_id} to vector store {vector_store_id}")

            return {
                "status": "success",
                "document_id": str(document.id),
                "knowledge_base_entry_id": str(knowledge_base_entry_id),
                "message": "Document added to vector store successfully"
            }

        except Exception as e:
            logger.error(f"Error adding knowledge base document: {e}")
            return {
                "status": "error",
                "message": f"Failed to add document: {str(e)}"
            }

    async def search_similar_content(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        query_text: str,
        owner_id: uuid.UUID,
        similarity_threshold: float = 0.7,
        max_results: int = 10,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """
        Search for similar content using vector similarity.
        
        Args:
            session: Database session
            vector_store_id: Vector store ID
            query_text: Search query
            owner_id: User ID
            similarity_threshold: Minimum similarity score
            max_results: Maximum number of results
            target_type: Optional target type filter
            target_id: Optional target ID filter
            api_key: Optional API key for validation
            
        Returns:
            Dictionary with search results
        """
        try:
            # Validate API key if provided
            if api_key:
                has_access = check_api_key_access(session, api_key)
                if not has_access:
                    return {
                        "status": "error",
                        "message": "Invalid API key or insufficient permissions"
                    }

            # Get vector store
            vector_store = vector_store_manager.get_vector_store(
                session, vector_store_id, owner_id
            )

            if not vector_store:
                return {
                    "status": "error",
                    "message": "Vector store not found"
                }

            # TODO: Implement actual vector search when embedding functionality is ready
            # For now, return placeholder results
            search_results = await self._placeholder_vector_search(
                session,
                vector_store,
                query_text,
                target_type,
                target_id,
                similarity_threshold,
                max_results,
            )

            return {
                "status": "success",
                "query": query_text,
                "vector_store_id": str(vector_store_id),
                "results_count": len(search_results),
                "results": search_results
            }

        except Exception as e:
            logger.error(f"Error searching similar content: {e}")
            return {
                "status": "error",
                "message": f"Search failed: {str(e)}"
            }

    async def _placeholder_vector_search(
        self,
        session: Session,
        vector_store: VectorStore,
        query_text: str,
        target_type: str | None,
        target_id: uuid.UUID | None,
        similarity_threshold: float,
        max_results: int,
    ) -> list[dict[str, Any]]:
        """
        Placeholder vector search implementation.
        TODO: Replace with actual vector similarity search when embedding functionality is ready.
        """
        # Get documents from vector store
        documents = vector_store_manager.list_documents(
            session, vector_store.id, vector_store.owner_id, target_type, target_id
        )

        # Simple text matching for now (placeholder)
        results = []
        for doc in documents[:max_results]:
            # Calculate simple similarity based on text matching
            similarity = self._calculate_text_similarity(query_text, doc.content)

            if similarity >= similarity_threshold:
                results.append({
                    "document_id": str(doc.id),
                    "knowledge_base_entry_id": str(doc.knowledge_base_entry_id),
                    "title": doc.title,
                    "similarity": similarity,
                    "target_type": doc.target_type,
                    "target_id": str(doc.target_id) if doc.target_id else None,
                    "created_at": doc.created_at.isoformat(),
                })

        return results

    def _calculate_text_similarity(self, query: str, content: str) -> float:
        """
        Calculate simple text similarity (placeholder implementation).
        TODO: Replace with proper semantic similarity using embeddings.
        """
        query_words = set(query.lower().split())
        content_words = set(content.lower().split())

        if not query_words or not content_words:
            return 0.0

        intersection = query_words.intersection(content_words)
        union = query_words.union(content_words)

        return len(intersection) / len(union) if union else 0.0

    async def get_vector_store_stats(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        owner_id: uuid.UUID,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """
        Get statistics for a vector store.
        
        Args:
            session: Database session
            vector_store_id: Vector store ID
            owner_id: User ID
            api_key: Optional API key for validation
            
        Returns:
            Dictionary with vector store statistics
        """
        try:
            # Validate API key if provided
            if api_key:
                has_access = check_api_key_access(session, api_key)
                if not has_access:
                    return {
                        "status": "error",
                        "message": "Invalid API key or insufficient permissions"
                    }

            # Get vector store
            vector_store = vector_store_manager.get_vector_store(
                session, vector_store_id, owner_id
            )

            if not vector_store:
                return {
                    "status": "error",
                    "message": "Vector store not found"
                }

            return {
                "status": "success",
                "vector_store_id": str(vector_store.id),
                "name": vector_store.name,
                "document_count": vector_store.document_count,
                "chunk_count": vector_store.chunk_count,
                "total_tokens": vector_store.total_tokens,
                "created_at": vector_store.created_at.isoformat(),
                "last_used_at": vector_store.last_used_at.isoformat() if vector_store.last_used_at else None,
            }

        except Exception as e:
            logger.error(f"Error getting vector store stats: {e}")
            return {
                "status": "error",
                "message": f"Failed to get stats: {str(e)}"
            }


# Global instance
supabase_faiss_tool = SupabaseFAISSTool()
