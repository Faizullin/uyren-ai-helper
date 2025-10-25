"""Vector Store Manager for handling vector operations."""

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from app.core.logger import logger
from app.modules.vector_store.models import (
    Document,
    DocumentChunk,
    SearchResult,
    VectorStore,
    VectorStoreConfig,
    VectorStoreProvider,
    VectorStoreStats,
)
from app.modules.vector_store.registry import vector_store_registry


class VectorStoreManager:
    """Manager for vector store operations."""

    def __init__(self):
        self.registry = vector_store_registry

    def create_vector_store(
        self,
        session: Session,
        owner_id: uuid.UUID,
        name: str,
        project_id: uuid.UUID | None = None,
        description: str | None = None,
        custom_config: dict[str, Any] | None = None,
    ) -> VectorStore:
        """Create a new Supabase vector store."""

        # Get Supabase configuration
        base_config = self.registry.get_config(VectorStoreProvider.SUPABASE)
        if not base_config:
            raise ValueError("Supabase vector store configuration not found")

        # Merge custom configuration
        config_dict = base_config.config.copy()
        if custom_config:
            config_dict.update(custom_config)

        # Create vector store configuration
        vector_config = VectorStoreConfig(
            provider=VectorStoreProvider.SUPABASE,
            name=name,
            description=description or base_config.description,
            config=config_dict,
            embedding_model=base_config.embedding_model,
            embedding_dimension=base_config.embedding_dimension,
            batch_size=base_config.batch_size,
            max_retries=base_config.max_retries,
            timeout=base_config.timeout,
        )

        # Create vector store record
        vector_store = VectorStore(
            owner_id=owner_id,
            project_id=project_id,
            name=name,
            description=description,
            provider=VectorStoreProvider.SUPABASE.value,
            config=json.dumps(vector_config.model_dump()),
            status="active",
        )

        session.add(vector_store)
        session.commit()
        session.refresh(vector_store)

        logger.info(f"Created Supabase vector store {vector_store.id}")

        return vector_store

    def get_vector_store(
        self, session: Session, vector_store_id: uuid.UUID, owner_id: uuid.UUID
    ) -> VectorStore | None:
        """Get a vector store by ID."""

        statement = select(VectorStore).where(
            VectorStore.id == vector_store_id,
            VectorStore.owner_id == owner_id,
        )
        return session.exec(statement).first()

    def list_vector_stores(
        self,
        session: Session,
        owner_id: uuid.UUID,
        project_id: uuid.UUID | None = None,
    ) -> list[VectorStore]:
        """List Supabase vector stores for a user."""

        statement = select(VectorStore).where(
            VectorStore.owner_id == owner_id,
            VectorStore.provider == VectorStoreProvider.SUPABASE.value,
        )

        if project_id:
            statement = statement.where(VectorStore.project_id == project_id)

        statement = statement.order_by(VectorStore.created_at.desc())

        return session.exec(statement).all()

    def update_vector_store(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        owner_id: uuid.UUID,
        **updates: Any,
    ) -> VectorStore | None:
        """Update a vector store."""

        vector_store = self.get_vector_store(session, vector_store_id, owner_id)
        if not vector_store:
            return None

        # Update fields
        for field, value in updates.items():
            if hasattr(vector_store, field):
                setattr(vector_store, field, value)

        vector_store.updated_at = datetime.now(timezone.utc)

        session.add(vector_store)
        session.commit()
        session.refresh(vector_store)

        logger.info(f"Updated vector store {vector_store_id}")

        return vector_store

    def delete_vector_store(
        self, session: Session, vector_store_id: uuid.UUID, owner_id: uuid.UUID
    ) -> bool:
        """Delete a vector store."""

        vector_store = self.get_vector_store(session, vector_store_id, owner_id)
        if not vector_store:
            return False

        session.delete(vector_store)
        session.commit()

        logger.info(f"Deleted vector store {vector_store_id}")

        return True

    def add_document(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        owner_id: uuid.UUID,
        title: str,
        content: str,
        content_type: str = "text/plain",
        source_url: str | None = None,
        source_file_path: str | None = None,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
    ) -> Document | None:
        """Add a document to a vector store."""

        vector_store = self.get_vector_store(session, vector_store_id, owner_id)
        if not vector_store:
            return None

        document = Document(
            vector_store_id=vector_store_id,
            owner_id=owner_id,
            target_type=target_type,
            target_id=target_id,
            title=title,
            content=content,
            content_type=content_type,
            source_url=source_url,
            source_file_path=source_file_path,
            processing_status="pending",
        )

        session.add(document)
        session.commit()
        session.refresh(document)

        logger.info(f"Added document {document.id} to vector store {vector_store_id}")

        return document

    def get_documents_by_target(
        self,
        session: Session,
        target_type: str,
        target_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> list[Document]:
        """Get documents by target type and ID (e.g., course or lesson)."""

        statement = select(Document).where(
            Document.target_type == target_type,
            Document.target_id == target_id,
            Document.owner_id == owner_id,
        )

        statement = statement.order_by(Document.created_at.desc())

        return session.exec(statement).all()

    def add_course_document(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        owner_id: uuid.UUID,
        course_id: uuid.UUID,
        title: str,
        content: str,
        content_type: str = "text/plain",
        source_url: str | None = None,
        source_file_path: str | None = None,
    ) -> Document | None:
        """Add a document for a specific course."""
        return self.add_document(
            session=session,
            vector_store_id=vector_store_id,
            owner_id=owner_id,
            title=title,
            content=content,
            content_type=content_type,
            source_url=source_url,
            source_file_path=source_file_path,
            target_type="course",
            target_id=course_id,
        )

    def add_lesson_document(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        owner_id: uuid.UUID,
        lesson_id: uuid.UUID,
        title: str,
        content: str,
        content_type: str = "text/plain",
        source_url: str | None = None,
        source_file_path: str | None = None,
    ) -> Document | None:
        """Add a document for a specific lesson."""
        return self.add_document(
            session=session,
            vector_store_id=vector_store_id,
            owner_id=owner_id,
            title=title,
            content=content,
            content_type=content_type,
            source_url=source_url,
            source_file_path=source_file_path,
            target_type="lesson",
            target_id=lesson_id,
        )

    def get_course_documents(
        self,
        session: Session,
        course_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> list[Document]:
        """Get all documents for a specific course."""
        return self.get_documents_by_target(
            session=session,
            target_type="course",
            target_id=course_id,
            owner_id=owner_id,
        )

    def get_lesson_documents(
        self,
        session: Session,
        lesson_id: uuid.UUID,
        owner_id: uuid.UUID,
    ) -> list[Document]:
        """Get all documents for a specific lesson."""
        return self.get_documents_by_target(
            session=session,
            target_type="lesson",
            target_id=lesson_id,
            owner_id=owner_id,
        )

    def chunk_document(
        self,
        session: Session,
        document_id: uuid.UUID,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ) -> list[DocumentChunk]:
        """Chunk a document into smaller pieces."""

        document = session.get(Document, document_id)
        if not document:
            return []

        # Simple text chunking (can be enhanced with more sophisticated methods)
        content = document.content
        chunks = []

        start = 0
        chunk_index = 0

        while start < len(content):
            end = min(start + chunk_size, len(content))

            # Try to break at sentence boundary
            if end < len(content):
                for i in range(end, max(start, end - 100), -1):
                    if content[i] in ".!?\n":
                        end = i + 1
                        break

            chunk_content = content[start:end].strip()
            if chunk_content:
                chunk = DocumentChunk(
                    document_id=document_id,
                    vector_store_id=document.vector_store_id,
                    content=chunk_content,
                    chunk_index=chunk_index,
                    chunk_size=len(chunk_content),
                    status="pending",
                )

                chunks.append(chunk)
                chunk_index += 1

            start = end - chunk_overlap

        # Save chunks to database
        for chunk in chunks:
            session.add(chunk)

        session.commit()

        # Update document chunk count
        document.chunk_count = len(chunks)
        document.processing_status = "completed"
        document.processed_at = datetime.now(timezone.utc)

        session.add(document)
        session.commit()

        logger.info(f"Created {len(chunks)} chunks for document {document_id}")

        return chunks

    def embed_chunks(
        self,
        session: Session,
        chunk_ids: list[uuid.UUID],
        embedding_model: str | None = None,
    ) -> list[DocumentChunk]:
        """Embed document chunks (placeholder implementation)."""

        # This is a placeholder implementation
        # In a real implementation, you would:
        # 1. Get the embedding model configuration
        # 2. Call the embedding API (OpenAI, HuggingFace, etc.)
        # 3. Store the embeddings in the vector database
        # 4. Update the chunk status

        chunks = session.exec(
            select(DocumentChunk).where(DocumentChunk.id.in_(chunk_ids))
        ).all()

        for chunk in chunks:
            # Placeholder: mark as embedded
            chunk.status = "embedded"
            chunk.embedded_at = datetime.now(timezone.utc)
            chunk.embedding_model = embedding_model or "text-embedding-3-small"

            session.add(chunk)

        session.commit()

        logger.info(f"Embedded {len(chunks)} chunks")

        return chunks

    def search_similar(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        query: str,
        limit: int = 10,
        score_threshold: float = 0.7,
    ) -> list[SearchResult]:
        """Search for similar documents (placeholder implementation)."""

        # This is a placeholder implementation
        # In a real implementation, you would:
        # 1. Embed the query using the same model as the chunks
        # 2. Perform similarity search in the vector database
        # 3. Return ranked results

        vector_store = session.get(VectorStore, vector_store_id)
        if not vector_store:
            return []

        # Placeholder: return empty results
        logger.info(f"Searching vector store {vector_store_id} for query: {query}")

        return []

    def get_vector_store_stats(
        self, session: Session, vector_store_id: uuid.UUID
    ) -> VectorStoreStats | None:
        """Get statistics for a vector store."""

        vector_store = session.get(VectorStore, vector_store_id)
        if not vector_store:
            return None

        # Get document count
        document_count = session.exec(
            select(Document).where(Document.vector_store_id == vector_store_id)
        ).count()

        # Get chunk count
        chunk_count = session.exec(
            select(DocumentChunk).where(
                DocumentChunk.vector_store_id == vector_store_id
            )
        ).count()

        # Get total tokens (placeholder)
        total_tokens = sum(
            session.exec(
                select(Document.total_tokens).where(
                    Document.vector_store_id == vector_store_id
                )
            ).all()
        )

        return VectorStoreStats(
            vector_store_id=vector_store_id,
            document_count=document_count,
            chunk_count=chunk_count,
            total_tokens=total_tokens,
            storage_size_bytes=0,  # Placeholder
            last_updated=vector_store.updated_at,
        )

    def get_provider_config(
        self, provider: VectorStoreProvider
    ) -> VectorStoreConfig | None:
        """Get configuration for a vector store provider."""
        return self.registry.get_config(provider)

    def list_supported_providers(self) -> list[str]:
        """List all supported vector store providers."""
        return self.registry.list_providers()


# Global manager instance
vector_store_manager = VectorStoreManager()
