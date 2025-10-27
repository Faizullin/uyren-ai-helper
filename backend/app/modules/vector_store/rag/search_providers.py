"""Search providers for vector similarity search."""

import uuid
from abc import ABC, abstractmethod
from typing import Any

import faiss  # type: ignore
import numpy as np
from sqlmodel import Session, select, text

from app.core.logger import logger
from app.modules.vector_store.models import Page, PageSection


class SearchProvider(ABC):
    """Abstract base class for search providers."""

    @abstractmethod
    async def search(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        query_embedding: list[float],
        top_k: int,
        similarity_threshold: float,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """Perform similarity search and return results."""
        pass


class PgVectorProvider(SearchProvider):
    """
    Search provider using PostgreSQL pgvector extension.

    Pros:
    - Direct database query (no in-memory index)
    - Consistent with source of truth
    - Simple to maintain
    - Good for small to medium datasets

    Cons:
    - Slower for very large datasets
    - Limited to PostgreSQL distance metrics
    """

    async def search(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        query_embedding: list[float],
        top_k: int,
        similarity_threshold: float,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """Search using pgvector inner product for cosine similarity."""
        try:
            result = session.execute(
                text("""
                    SELECT
                        ps.id,
                        ps.page_id,
                        ps.content,
                        ps.heading,
                        ps.slug,
                        p.path,
                        p.target_type,
                        p.target_id,
                        (ps.embedding <#> :query_embedding::vector) * -1 as similarity
                    FROM vector_store.page_section ps
                    JOIN vector_store.page p ON ps.page_id = p.id
                    WHERE
                        p.vector_store_id = :vector_store_id
                        AND ps.embedding IS NOT NULL
                        AND length(ps.content) >= 50
                        AND (ps.embedding <#> :query_embedding::vector) * -1 > :threshold
                        AND (:target_type::text IS NULL OR p.target_type = :target_type)
                        AND (:target_id::uuid IS NULL OR p.target_id = :target_id)
                    ORDER BY ps.embedding <#> :query_embedding::vector
                    LIMIT :top_k
                """),
                {
                    "query_embedding": str(query_embedding),
                    "vector_store_id": str(vector_store_id),
                    "threshold": similarity_threshold,
                    "top_k": top_k,
                    "target_type": target_type,
                    "target_id": str(target_id) if target_id else None,
                },
            )

            rows = result.fetchall()

            # Format results
            search_results = []
            for row in rows:
                search_results.append(
                    {
                        "id": str(row.id),
                        "page_id": str(row.page_id),
                        "content": row.content,
                        "heading": row.heading,
                        "slug": row.slug,
                        "path": row.path,
                        "target_type": row.target_type,
                        "target_id": str(row.target_id) if row.target_id else None,
                        "similarity": float(row.similarity),
                    }
                )

            logger.info(f"PgVector search returned {len(search_results)} results")
            return search_results

        except Exception as e:
            logger.error(f"Error in pgvector search: {str(e)}")
            raise


class FaissSupabaseProvider(SearchProvider):
    """
    Search provider using FAISS with Supabase backend.

    Pros:
    - Very fast for large datasets (optimized C++ implementation)
    - Multiple index types (Flat, IVF, HNSW)
    - In-memory speed
    - Scalable to billions of vectors

    Cons:
    - Requires loading embeddings into memory
    - Fresh index per request (unless cached)
    - More complex maintenance

    Implementation:
    - Loads embeddings from Supabase on each search
    - Builds FAISS IndexFlatIP (inner product)
    - Normalizes embeddings for cosine similarity
    - Returns top-k results with similarity scores
    """

    async def search(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        query_embedding: list[float],
        top_k: int,
        similarity_threshold: float,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """Search using FAISS IndexFlatIP for fast similarity search."""
        try:
            # Step 1: Load page sections with embeddings from database
            query = (
                select(PageSection, Page.path, Page.target_type, Page.target_id)
                .join(Page, PageSection.page_id == Page.id)
                .where(
                    Page.vector_store_id == vector_store_id,
                    PageSection.embedding.is_not(None),  # type: ignore
                )
            )

            # Apply optional filters
            if target_type:
                query = query.where(Page.target_type == target_type)
            if target_id:
                query = query.where(Page.target_id == target_id)

            results = session.exec(query).all()

            if not results:
                logger.warning(f"No embeddings found for vector_store {vector_store_id}")
                return []

            # Step 2: Extract embeddings and metadata
            embeddings_list = []
            metadata_list = []

            for page_section, path, target_type_val, target_id_val in results:
                if page_section.embedding is not None and len(page_section.embedding) > 0:
                    embeddings_list.append(page_section.embedding)
                    metadata_list.append(
                        {
                            "id": str(page_section.id),
                            "page_id": str(page_section.page_id),
                            "content": page_section.content,
                            "heading": page_section.heading,
                            "slug": page_section.slug,
                            "path": path,
                            "target_type": target_type_val,
                            "target_id": str(target_id_val) if target_id_val else None,
                        }
                    )

            if not embeddings_list:
                return []

            # Step 3: Convert to numpy array
            embeddings_array = np.array(embeddings_list, dtype=np.float32)

            # Step 4: Create FAISS index
            dimension = embeddings_array.shape[1]
            index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity

            # Normalize embeddings for cosine similarity
            faiss.normalize_L2(embeddings_array)
            index.add(embeddings_array)

            # Step 5: Prepare query embedding
            query_embedding_array = np.array([query_embedding], dtype=np.float32)
            faiss.normalize_L2(query_embedding_array)

            # Step 6: Perform FAISS search
            scores, indices = index.search(query_embedding_array, min(top_k, len(embeddings_list)))


            # Step 7: Format results with similarity threshold
            search_results = []
            for i, idx in enumerate(indices[0]):
                if idx != -1:  # Valid index
                    similarity = float(scores[0][i])

                    # Apply similarity threshold
                    if similarity > similarity_threshold:
                        result = metadata_list[idx].copy()
                        result["similarity"] = similarity
                        search_results.append(result)

            logger.info(f"FAISS search returned {len(search_results)} results")
            return search_results

        except Exception as e:
            logger.error(f"Error in FAISS search: {str(e)}")
            raise


# Provider instances
pgvector_provider = PgVectorProvider()
faiss_supabase_provider = FaissSupabaseProvider()


def get_search_provider(provider_name: str = "pgvector") -> SearchProvider:
    """Get search provider by name."""
    providers = {
        "pgvector": pgvector_provider,
        "faiss": faiss_supabase_provider,
    }

    provider = providers.get(provider_name.lower())
    if not provider:
        raise ValueError(
            f"Unknown search provider: {provider_name}. Available: {list(providers.keys())}"
        )

    return provider

