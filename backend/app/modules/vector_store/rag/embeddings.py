"""Embedding service using LangChain for RAG."""

import uuid
from datetime import datetime, timezone

from langchain_openai import OpenAIEmbeddings
from sqlmodel import Session, select, text

from app.core.config import settings
from app.core.logger import logger
from app.modules.vector_store.models import PageSection


class EmbeddingService:
    """Service for generating and managing vector embeddings using LangChain."""

    def __init__(self):
        if not settings.DEFAULT_OPENAI_API_KEY:
            logger.warning("OpenAI API key not configured for embeddings")
            self.embeddings = None
        else:
            # Initialize LangChain OpenAI Embeddings
            self.embeddings = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=settings.DEFAULT_OPENAI_API_KEY,
            )
        self.model = "text-embedding-3-small"
        self.dimension = 1536

    async def generate_embedding(self, text: str) -> list[float]:
        """
        Generate embedding for a single text using LangChain.

        Args:
            text: Text to embed

        Returns:
            list[float]: Embedding vector (1536 dimensions)
        """
        if not self.embeddings:
            raise ValueError("OpenAI API key not configured")

        try:
            # Use LangChain's embed_query method
            embedding = await self.embeddings.aembed_query(text)

            logger.info(f"Generated embedding for text ({len(text)} chars)")
            return embedding

        except Exception as e:
            logger.error(f"Error generating embedding: {str(e)}")
            raise ValueError(f"Failed to generate embedding: {str(e)}")

    async def generate_embeddings_batch(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings for multiple texts using LangChain.

        Args:
            texts: List of texts to embed

        Returns:
            list[list[float]]: List of embedding vectors
        """
        if not self.embeddings:
            raise ValueError("OpenAI API key not configured")

        try:
            # Use LangChain's embed_documents method for batch processing
            embeddings = await self.embeddings.aembed_documents(texts)

            logger.info(f"Generated {len(embeddings)} embeddings in batch")
            return embeddings

        except Exception as e:
            logger.error(f"Error generating batch embeddings: {str(e)}")
            raise ValueError(f"Failed to generate embeddings: {str(e)}")

    async def embed_page_sections_batch(
        self, session: Session, section_ids: list[uuid.UUID], batch_size: int = 100
    ) -> int:
        """
        Generate and store embeddings for multiple page sections using LangChain batch processing.

        Args:
            session: Database session
            section_ids: List of PageSection IDs
            batch_size: Batch size for processing

        Returns:
            int: Number of sections successfully embedded
        """
        # Get sections
        sections = list(
            session.exec(
                select(PageSection).where(PageSection.id.in_(section_ids))
            ).all()
        )

        if not sections:
            return 0

        # Process in batches
        embedded_count = 0
        for i in range(0, len(sections), batch_size):
            batch = sections[i : i + batch_size]

            # Extract texts from batch
            texts = [section.content for section in batch]

            try:
                # Generate embeddings using LangChain batch method
                embeddings = await self.generate_embeddings_batch(texts)

                # Store embeddings
                for section, embedding in zip(batch, embeddings):
                    try:
                        session.execute(
                            text(
                                """
                                UPDATE vector_store.page_section 
                                SET embedding = :embedding::vector,
                                    updated_at = :updated_at
                                WHERE id = :section_id
                            """
                            ),
                            {
                                "embedding": str(embedding),
                                "updated_at": datetime.now(timezone.utc),
                                "section_id": str(section.id),
                            },
                        )
                        embedded_count += 1

                    except Exception as e:
                        logger.error(
                            f"Error storing embedding for section {section.id}: {str(e)}"
                        )
                        continue

                session.commit()
                logger.info(
                    f"Batch {i // batch_size + 1}: Embedded {len(batch)} sections"
                )

            except Exception as e:
                logger.error(f"Error in batch {i // batch_size + 1}: {str(e)}")
                continue

        logger.info(f"Total embedded: {embedded_count}/{len(sections)} sections")
        return embedded_count

    async def embed_all_page_sections(
        self, session: Session, page_id: uuid.UUID
    ) -> int:
        """
        Generate embeddings for all sections of a page using LangChain.

        Args:
            session: Database session
            page_id: Page ID

        Returns:
            int: Number of sections embedded
        """
        # Get all sections for page
        sections = list(
            session.exec(
                select(PageSection).where(PageSection.page_id == page_id)
            ).all()
        )

        if not sections:
            return 0

        section_ids = [section.id for section in sections]
        return await self.embed_page_sections_batch(session, section_ids)

    def estimate_cost(self, text_length: int) -> float:
        """
        Estimate embedding cost for text.

        Args:
            text_length: Character count

        Returns:
            float: Estimated cost in USD
        """
        # Rough estimate: 1 token ≈ 4 characters
        estimated_tokens = text_length / 4

        # OpenAI pricing: text-embedding-3-small = $0.00002 per 1K tokens
        cost_per_1k_tokens = 0.00002
        estimated_cost = (estimated_tokens / 1000) * cost_per_1k_tokens

        return estimated_cost

    def estimate_batch_cost(self, texts: list[str]) -> dict:
        """
        Estimate cost for batch embedding.

        Returns:
            dict with total_chars, estimated_tokens, estimated_cost
        """
        total_chars = sum(len(text) for text in texts)
        estimated_tokens = total_chars / 4
        estimated_cost = (estimated_tokens / 1000) * 0.00002

        return {
            "total_texts": len(texts),
            "total_chars": total_chars,
            "estimated_tokens": int(estimated_tokens),
            "estimated_cost_usd": round(estimated_cost, 6),
        }


# Global service instance
embedding_service = EmbeddingService()
