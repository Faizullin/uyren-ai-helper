"""Vector Store Manager for Page and PageSection operations."""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from app.core.logger import logger
from app.modules.vector_store.models import Page, PageSection, VectorStore


class VectorStoreManager:
    """Manager for vector store, page, and page section operations."""

    # ==================== VectorStore Operations ====================

    def create_vector_store(
        self,
        session: Session,
        owner_id: uuid.UUID,
        name: str,
        project_id: uuid.UUID | None = None,
        description: str | None = None,
    ) -> VectorStore:
        """Create a new vector store."""

        vector_store = VectorStore(
            owner_id=owner_id,
            project_id=project_id,
            name=name,
            description=description,
            provider="supabase",
            config=json.dumps({"embedding_model": "text-embedding-3-small", "dimension": 1536}),
            status="active",
        )

        session.add(vector_store)
        session.commit()
        session.refresh(vector_store)

        logger.info(f"Created vector store {vector_store.id}")
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
        """List vector stores for a user."""
        statement = select(VectorStore).where(VectorStore.owner_id == owner_id)

        if project_id:
            statement = statement.where(VectorStore.project_id == project_id)

        statement = statement.order_by(VectorStore.created_at.desc())
        return list(session.exec(statement).all())

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
        """Delete a vector store and all associated pages/sections."""
        vector_store = self.get_vector_store(session, vector_store_id, owner_id)
        if not vector_store:
            return False

        session.delete(vector_store)
        session.commit()

        logger.info(f"Deleted vector store {vector_store_id}")
        return True

    # ==================== Page Operations ====================

    def create_page(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        owner_id: uuid.UUID,
        path: str,
        content: str | None = None,
        meta: dict[str, Any] | None = None,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
        source: str | None = None,
        parent_page_id: uuid.UUID | None = None,
    ) -> Page:
        """Create a new page."""
        # Calculate checksum
        checksum = hashlib.sha256((content or "").encode("utf-8")).hexdigest()

        page = Page(
            owner_id=owner_id,
            vector_store_id=vector_store_id,
            parent_page_id=parent_page_id,
            path=path,
            checksum=checksum,
            meta=json.dumps(meta) if meta else None,
            target_type=target_type,
            target_id=target_id,
            source=source,
            version=uuid.uuid4(),
        )

        session.add(page)
        session.commit()
        session.refresh(page)

        logger.info(f"Created page {page.id} at path: {path}")
        return page

    def get_page(
        self, session: Session, page_id: uuid.UUID, owner_id: uuid.UUID
    ) -> Page | None:
        """Get a page by ID."""
        statement = select(Page).where(
            Page.id == page_id,
            Page.owner_id == owner_id,
        )
        return session.exec(statement).first()

    def get_page_by_path(
        self, session: Session, path: str, vector_store_id: uuid.UUID
    ) -> Page | None:
        """Get a page by path."""
        statement = select(Page).where(
            Page.path == path,
            Page.vector_store_id == vector_store_id,
        )
        return session.exec(statement).first()

    def list_pages(
        self,
        session: Session,
        vector_store_id: uuid.UUID,
        owner_id: uuid.UUID,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
    ) -> list[Page]:
        """List pages in a vector store."""
        statement = select(Page).where(
            Page.vector_store_id == vector_store_id,
            Page.owner_id == owner_id,
        )

        if target_type:
            statement = statement.where(Page.target_type == target_type)
        if target_id:
            statement = statement.where(Page.target_id == target_id)

        statement = statement.order_by(Page.created_at.desc())
        return list(session.exec(statement).all())

    def update_page(
        self,
        session: Session,
        page_id: uuid.UUID,
        owner_id: uuid.UUID,
        **updates: Any,
    ) -> Page | None:
        """Update a page."""
        page = self.get_page(session, page_id, owner_id)
        if not page:
            return None

        for field, value in updates.items():
            if hasattr(page, field):
                setattr(page, field, value)

        page.updated_at = datetime.now(timezone.utc)
        page.last_refresh = datetime.now(timezone.utc)

        session.add(page)
        session.commit()
        session.refresh(page)

        logger.info(f"Updated page {page_id}")
        return page

    def delete_page(
        self, session: Session, page_id: uuid.UUID, owner_id: uuid.UUID
    ) -> bool:
        """Delete a page and all its sections."""
        page = self.get_page(session, page_id, owner_id)
        if not page:
            return False

        # First, delete all page sections
        sections = session.exec(
            select(PageSection).where(PageSection.page_id == page_id)
        ).all()

        for section in sections:
            session.delete(section)

        logger.info(f"Deleted {len(sections)} sections for page {page_id}")

        # Then delete the page itself
        session.delete(page)
        session.commit()

        logger.info(f"Deleted page {page_id}")
        return True

    # ==================== PageSection Operations ====================

    def create_page_section(
        self,
        session: Session,
        page_id: uuid.UUID,
        content: str,
        heading: str | None = None,
        slug: str | None = None,
        embedding: list[float] | None = None,
    ) -> PageSection:
        """Create a new page section with optional embedding."""
        # Estimate token count
        token_count = len(content.split())

        section = PageSection(
            page_id=page_id,
            content=content,
            token_count=token_count,
            slug=slug,
            heading=heading,
            embedding=embedding,
        )

        session.add(section)
        session.commit()
        session.refresh(section)

        logger.info(f"Created page section {section.id} for page {page_id}")
        return section

    def get_page_section(
        self, session: Session, section_id: uuid.UUID
    ) -> PageSection | None:
        """Get a page section by ID."""
        return session.get(PageSection, section_id)

    def list_page_sections(
        self, session: Session, page_id: uuid.UUID
    ) -> list[PageSection]:
        """List all sections for a page."""
        statement = select(PageSection).where(
            PageSection.page_id == page_id
        ).order_by(PageSection.created_at.asc())
        return list(session.exec(statement).all())

    def update_page_section_embedding(
        self,
        session: Session,
        section_id: uuid.UUID,
        embedding: list[float],
    ) -> PageSection | None:
        """Update the embedding for a page section."""
        section = self.get_page_section(session, section_id)
        if not section:
            return None

        section.embedding = embedding
        section.updated_at = datetime.now(timezone.utc)

        session.add(section)
        session.commit()
        session.refresh(section)

        logger.info(f"Updated embedding for section {section_id}")
        return section

    def delete_page_section(
        self, session: Session, section_id: uuid.UUID
    ) -> bool:
        """Delete a page section."""
        section = self.get_page_section(session, section_id)
        if not section:
            return False

        session.delete(section)
        session.commit()

        logger.info(f"Deleted page section {section_id}")
        return True

    def chunk_content_to_sections(
        self,
        session: Session,
        page_id: uuid.UUID,
        content: str,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ) -> list[PageSection]:
        """Chunk content and create page sections."""
        sections = []
        start = 0
        index = 0

        while start < len(content):
            end = min(start + chunk_size, len(content))

            # Try to break at sentence boundary
            if end < len(content):
                for char in ["\n\n", "\n", ". ", "! ", "? "]:
                    pos = content.rfind(char, start, end)
                    if pos > start:
                        end = pos + len(char)
                        break

            chunk = content[start:end].strip()
            if chunk:
                section = self.create_page_section(
                    session=session,
                    page_id=page_id,
                    content=chunk,
                    slug=f"section-{index}",
                )
                sections.append(section)
                index += 1

            start = end - chunk_overlap

        logger.info(f"Created {len(sections)} sections for page {page_id}")
        return sections


# Global manager instance
vector_store_manager = VectorStoreManager()
