"""RAG module for document processing and embeddings using LangChain."""

from app.modules.vector_store.rag.document_processor import document_processor
from app.modules.vector_store.rag.embeddings import embedding_service
from app.modules.vector_store.rag.kb_integration import kb_integration
from app.modules.vector_store.rag.search_providers import (
    faiss_supabase_provider,
    get_search_provider,
    pgvector_provider,
)

__all__ = [
    "document_processor",
    "embedding_service",
    "kb_integration",
    "get_search_provider",
    "pgvector_provider",
    "faiss_supabase_provider",
]

