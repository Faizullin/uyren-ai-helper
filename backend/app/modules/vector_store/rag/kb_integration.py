"""Knowledge Base integration for automatic RAG processing."""

import uuid

from sqlmodel import Session, select

from app.core.logger import logger
from app.models.knowledge_base import KnowledgeBaseEntry
from app.modules.vector_store.manager import vector_store_manager
from app.modules.vector_store.models import Page
from app.modules.vector_store.rag import document_processor, embedding_service
from app.services.storage_service import get_storage_service


class KnowledgeBaseIntegration:
    """Handle automatic knowledge base file processing for vector stores."""

    def __init__(self):
        self.storage_service = get_storage_service(prefix="knowledge-base")

    async def process_kb_entry_for_rag(
        self,
        session: Session,
        kb_entry_id: uuid.UUID,
        vector_store_id: uuid.UUID,
        owner_id: uuid.UUID,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
        chunk_size: int = 1000,
        chunk_overlap: int = 200,
    ) -> dict:
        """
        Process a knowledge base entry for RAG.

        Workflow:
        1. Get KB entry
        2. Download file from storage
        3. Extract text (PDF/DOCX/TXT)
        4. Create Page
        5. Chunk into PageSections
        6. Return page_id and section count

        Args:
            session: Database session
            kb_entry_id: Knowledge base entry ID
            vector_store_id: Target vector store
            owner_id: User ID
            target_type: Optional target type (course, lesson)
            target_id: Optional target ID
            chunk_size: Chunk size for text splitting
            chunk_overlap: Overlap between chunks

        Returns:
            dict with page_id, sections_created, status
        """
        try:
            # Get KB entry
            kb_entry = session.exec(
                select(KnowledgeBaseEntry).where(
                    KnowledgeBaseEntry.id == kb_entry_id,
                    KnowledgeBaseEntry.owner_id == owner_id,
                    KnowledgeBaseEntry.is_active.is_(True),
                )
            ).first()

            if not kb_entry:
                return {
                    "status": "error",
                    "message": "Knowledge base entry not found or inactive",
                }

            # Check if already processed (avoid duplicates)
            existing_page = session.exec(
                select(Page).where(
                    Page.vector_store_id == vector_store_id,
                    Page.source == kb_entry.filename,
                    Page.checksum == kb_entry.file_path,  # Using file_path as unique identifier
                )
            ).first()

            if existing_page:
                return {
                    "status": "skipped",
                    "message": "File already processed for this vector store",
                    "page_id": str(existing_page.id),
                }

            # Download file from storage
            file_content = await self.storage_service.read_file(kb_entry.file_path)
            if not file_content:
                return {
                    "status": "error",
                    "message": "Failed to read file from storage",
                }

            # Process file
            try:
                result = document_processor.process_file(
                    file_content=file_content,
                    filename=kb_entry.filename,
                    chunk_size=chunk_size,
                    chunk_overlap=chunk_overlap,
                )

                content = result["content"]
                chunks = result["chunks"]
                metadata = result["metadata"]

            except ValueError as e:
                # Extraction failed - return error without creating page
                logger.error(f"File extraction failed for {kb_entry.filename}: {str(e)}")
                return {
                    "status": "error",
                    "message": f"Failed to extract text from file: {str(e)}",
                    "filename": kb_entry.filename,
                }
            except Exception as e:
                logger.error(f"Error processing file {kb_entry.filename}: {str(e)}")
                return {
                    "status": "error",
                    "message": f"Failed to process file: {str(e)}",
                    "filename": kb_entry.filename,
                }

            # Add KB metadata
            metadata["knowledge_base_entry_id"] = str(kb_entry_id)
            metadata["mime_type"] = kb_entry.mime_type
            metadata["kb_summary"] = kb_entry.summary

            # Generate unique path
            from app.modules.vector_store.utils import generate_page_path

            path = generate_page_path(
                target_type,
                str(target_id) if target_id else None,
                kb_entry.filename,
            )

            # Create page
            page = vector_store_manager.create_page(
                session=session,
                vector_store_id=vector_store_id,
                owner_id=owner_id,
                path=path,
                content=content,
                meta=metadata,
                target_type=target_type,
                target_id=target_id,
                source=kb_entry.filename,
            )

            sections = []
            for chunk in chunks:
                section = vector_store_manager.create_page_section(
                    session=session,
                    page_id=page.id,
                    content=chunk["content"],
                    slug=f"section-{chunk['index']}",
                )
                sections.append(section)

                # Generate and update embedding for the section
                try:
                    embedding = await embedding_service.generate_embedding(chunk["content"])
                    vector_store_manager.update_page_section_embedding(
                        session=session,
                        section_id=section.id,
                        embedding=embedding,
                    )
                    logger.debug(f"Generated embedding for section {section.id}")
                except Exception as e:
                    logger.warning(
                        f"Failed to generate embedding for section {section.id}: {str(e)}"
                    )

            logger.info(
                f"Processed KB entry {kb_entry_id} for RAG - "
                f"Created page {page.id} with {len(sections)} sections and embeddings"
            )

            return {
                "status": "success",
                "page_id": str(page.id),
                "sections_created": len(sections),
                "filename": kb_entry.filename,
                "message": f"Knowledge base file processed - {len(sections)} sections created",
            }

        except Exception as e:
            logger.error(f"Error processing KB entry for RAG: {str(e)}")
            return {
                "status": "error",
                "message": f"Processing failed: {str(e)}",
            }

    async def bulk_process_kb_folder(
        self,
        session: Session,
        folder_id: uuid.UUID,
        vector_store_id: uuid.UUID,
        owner_id: uuid.UUID,
        target_type: str | None = None,
        target_id: uuid.UUID | None = None,
    ) -> dict:
        """
        Process all files in a knowledge base folder for RAG.

        Args:
            session: Database session
            folder_id: Knowledge base folder ID
            vector_store_id: Target vector store
            owner_id: User ID
            target_type: Optional target type
            target_id: Optional target ID

        Returns:
            dict with processed_count, skipped_count, failed_count
        """
        # Get all active entries in folder
        entries = session.exec(
            select(KnowledgeBaseEntry).where(
                KnowledgeBaseEntry.folder_id == folder_id,
                KnowledgeBaseEntry.owner_id == owner_id,
                KnowledgeBaseEntry.is_active.is_(True),
            )
        ).all()

        processed = 0
        skipped = 0
        failed = 0
        results = []

        for entry in entries:
            result = await self.process_kb_entry_for_rag(
                session=session,
                kb_entry_id=entry.id,
                vector_store_id=vector_store_id,
                owner_id=owner_id,
                target_type=target_type,
                target_id=target_id,
            )

            results.append({
                "entry_id": str(entry.id),
                "filename": entry.filename,
                "status": result["status"],
                "page_id": result.get("page_id"),
            })

            if result["status"] == "success":
                processed += 1
            elif result["status"] == "skipped":
                skipped += 1
            else:
                failed += 1

        logger.info(
            f"Bulk processed folder {folder_id}: "
            f"{processed} processed, {skipped} skipped, {failed} failed"
        )

        return {
            "status": "completed",
            "total_entries": len(entries),
            "processed": processed,
            "skipped": skipped,
            "failed": failed,
            "results": results,
        }


# Global instance
kb_integration = KnowledgeBaseIntegration()

