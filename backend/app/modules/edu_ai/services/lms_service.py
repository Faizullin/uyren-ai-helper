"""LMS service for educational content management."""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from app.core.logger import logger
from app.modules.edu_ai.models import LMSResource, ResourceAttachment
from app.modules.edu_ai.tools.fetcher import create_lms_fetcher
from app.services.storage_service import StorageService


class LMSService:
    """Service for managing LMS data and educational content."""

    def __init__(self, storage_service: StorageService):
        """Initialize the LMS service."""
        self.storage_service = storage_service
        self.fetcher = create_lms_fetcher(storage_service)

    async def fetch_and_store_course_data(
        self,
        session: Session,
        course_id: str,
        owner_id: uuid.UUID,
        lms_type: str = "cloudinary",
    ) -> dict[str, Any]:
        """
        Fetch course data from LMS and store it in the database.

        Args:
            session: Database session
            course_id: The course identifier
            owner_id: ID of the user who owns the course
            lms_type: Type of LMS adapter to use

        Returns:
            Dictionary containing the result of the fetch operation
        """
        try:
            logger.info(f"Starting LMS fetch for course {course_id} by user {owner_id}")

            # Fetch data from LMS
            fetch_result = await self.fetcher.fetch_course_data(course_id, lms_type)

            if fetch_result.get("status") != "success":
                logger.error(
                    f"Failed to fetch course data: {fetch_result.get('error')}"
                )
                return fetch_result

            # Store course materials in database
            stored_materials = await self._store_course_materials(
                session, fetch_result, owner_id
            )

            # Update result with database information
            fetch_result["stored_materials"] = stored_materials
            fetch_result["total_materials"] = len(stored_materials)

            logger.info(
                f"Successfully processed course {course_id} with {len(stored_materials)} materials"
            )
            return fetch_result

        except Exception as e:
            logger.error(f"Error in LMS service for course {course_id}: {str(e)}")
            return {"course_id": course_id, "status": "error", "error": str(e)}

    async def _store_course_materials(
        self, session: Session, fetch_result: dict[str, Any], owner_id: uuid.UUID
    ) -> list[dict[str, Any]]:
        """
        Store course materials in the database using LMSResource model.

        Args:
            session: Database session
            fetch_result: Result from LMS fetch operation
            owner_id: ID of the user who owns the course

        Returns:
            List of stored material information
        """
        stored_materials = []

        try:
            # Store files from the fetch result
            for stored_file in fetch_result.get("stored_files", []):
                # Create LMSResource for file
                lms_resource = LMSResource(
                    owner_id=owner_id,
                    title=stored_file.get("original_name", "Unknown"),
                    content=f"File stored at: {stored_file.get('stored_url')}",
                    thumbnail_url=None,
                    target_type="file",
                    target_id=None,
                    my_metadata={
                        "lms_fetch": True,
                        "lms_type": fetch_result.get("lms_type"),
                        "course_id": fetch_result.get("course_id"),
                        "file_info": stored_file,
                        "file_type": stored_file.get("file_type", "unknown"),
                        "source_url": stored_file.get("original_url"),
                        "stored_url": stored_file.get("stored_url"),
                    },
                    status="active",
                    is_public=False,
                )

                session.add(lms_resource)
                stored_materials.append(
                    {
                        "resource_id": str(lms_resource.id),
                        "title": lms_resource.title,
                        "type": "file",
                        "file_url": stored_file.get("stored_url"),
                    }
                )

            # Store course composition data as an LMSResource
            course_data = fetch_result.get("course_data", {})
            if course_data:
                composition_resource = LMSResource(
                    owner_id=owner_id,
                    title=f"Course Composition - {course_data.get('title', 'Unknown Course')}",
                    description="Course structure and content overview",
                    content=str(course_data),
                    thumbnail_url=None,
                    target_type="course",
                    target_id=None,
                    my_metadata={
                        "lms_fetch": True,
                        "lms_type": fetch_result.get("lms_type"),
                        "course_id": fetch_result.get("course_id"),
                        "composition_data": course_data,
                        "resource_type": "composition",
                    },
                    status="active",
                    is_public=False,
                )

                session.add(composition_resource)
                stored_materials.append(
                    {
                        "resource_id": str(composition_resource.id),
                        "title": composition_resource.title,
                        "type": "composition",
                        "course_id": fetch_result.get("course_id"),
                    }
                )

            session.commit()
            logger.info(f"Stored {len(stored_materials)} LMS resources in database")

        except Exception as e:
            session.rollback()
            logger.error(f"Error storing LMS resources: {str(e)}")
            raise e

        return stored_materials

    async def get_user_lms_resources(
        self, session: Session, owner_id: uuid.UUID, course_id: str | Nonestr] = None
    ) -> list[LMSResource]:
        """
        Get LMS resources for a user, optionally filtered by course ID.

        Args:
            session: Database session
            owner_id: ID of the user
            course_id: Optional course ID to filter by

        Returns:
            List of LMS resources
        """
        try:
            query = select(LMSResource).where(LMSResource.owner_id == owner_id)

            if course_id:
                # Filter by course ID in metadata
                query = query.where(
                    LMSResource.my_metadata["course_id"].astext == course_id
                )

            resources = session.exec(query).all()

            logger.info(f"Retrieved {len(resources)} LMS resources for user {owner_id}")
            return resources

        except Exception as e:
            logger.error(
                f"Error getting LMS resources for user {owner_id}: {str(e)}"
            )
            raise e

    async def delete_lms_resources(
        self, session: Session, owner_id: uuid.UUID, course_id: str
    ) -> bool:
        """
        Delete LMS resources for a specific course.

        Args:
            session: Database session
            owner_id: ID of the user
            course_id: Course ID to delete resources for

        Returns:
            True if deletion was successful
        """
        try:
            # Find resources for the course
            query = select(LMSResource).where(
                LMSResource.owner_id == owner_id,
                LMSResource.my_metadata["course_id"].astext == course_id,
            )

            resources = session.exec(query).all()

            # Delete each resource
            for resource in resources:
                session.delete(resource)

            session.commit()

            logger.info(f"Deleted {len(resources)} LMS resources for course {course_id}")
            return True

        except Exception as e:
            session.rollback()
            logger.error(f"Error deleting LMS resources for {course_id}: {str(e)}")
            return False

    async def get_resource_attachments(
        self, session: Session, resource_id: uuid.UUID, owner_id: uuid.UUID
    ) -> list[ResourceAttachment]:
        """
        Get all attachments for a specific LMS resource.

        Args:
            session: Database session
            resource_id: ID of the LMS resource
            owner_id: ID of the user

        Returns:
            List of resource attachments
        """
        try:
            query = select(ResourceAttachment).where(
                ResourceAttachment.lms_resource_id == resource_id,
                ResourceAttachment.owner_id == owner_id,
                ResourceAttachment.status == "active"
            ).order_by(ResourceAttachment.created_at.desc())

            attachments = session.exec(query).all()

            logger.info(f"Retrieved {len(attachments)} attachments for resource {resource_id}")
            return attachments

        except Exception as e:
            logger.error(f"Error getting attachments for resource {resource_id}: {str(e)}")
            raise e

    async def create_resource_attachment(
        self, 
        session: Session, 
        resource_id: uuid.UUID, 
        owner_id: uuid.UUID,
        title: str,
        file_url: str,
        file_name: str,
        description: str | None = None,
        file_size: int | None = None,
        content_type: str | None = None,
        my_metadata: dict[str, Any] | None = None
    ) -> ResourceAttachment:
        """
        Create a new resource attachment.

        Args:
            session: Database session
            resource_id: ID of the LMS resource
            owner_id: ID of the user
            title: Attachment title
            file_url: URL to the file
            file_name: Name of the file
            description: Optional description
            file_size: File size in bytes
            content_type: MIME type
            my_metadata: Optional metadata

        Returns:
            Created resource attachment
        """
        try:
            # Verify resource exists and user has access
            query = select(LMSResource).where(
                LMSResource.id == resource_id, LMSResource.owner_id == owner_id
            )
            resource = session.exec(query).first()
            
            if not resource:
                raise ValueError(f"LMS resource {resource_id} not found or access denied")

            attachment = ResourceAttachment(
                lms_resource_id=resource_id,
                owner_id=owner_id,
                title=title,
                description=description,
                file_url=file_url,
                file_name=file_name,
                file_size=file_size,
                content_type=content_type,
                my_metadata=my_metadata or {},
                status="active",
            )

            session.add(attachment)
            session.commit()
            session.refresh(attachment)

            logger.info(f"Created attachment {attachment.id} for resource {resource_id}")
            return attachment

        except Exception as e:
            session.rollback()
            logger.error(f"Error creating attachment for resource {resource_id}: {str(e)}")
            raise e

    async def delete_resource_attachment(
        self, session: Session, attachment_id: uuid.UUID, owner_id: uuid.UUID
    ) -> bool:
        """
        Delete a resource attachment (soft delete).

        Args:
            session: Database session
            attachment_id: ID of the attachment
            owner_id: ID of the user

        Returns:
            True if deletion was successful
        """
        try:
            query = select(ResourceAttachment).where(
                ResourceAttachment.id == attachment_id,
                ResourceAttachment.owner_id == owner_id,
                ResourceAttachment.status == "active"
            )

            attachment = session.exec(query).first()

            if not attachment:
                return False

            # Soft delete by updating status
            attachment.status = "deleted"
            attachment.updated_at = datetime.now(timezone.utc)

            session.add(attachment)
            session.commit()

            logger.info(f"Deleted attachment {attachment_id}")
            return True

        except Exception as e:
            session.rollback()
            logger.error(f"Error deleting attachment {attachment_id}: {str(e)}")
            return False


# Factory function for creating LMS service
def create_lms_service(storage_service: StorageService) -> LMSService:
    """
    Create an LMS service instance.

    Args:
        storage_service: Storage service instance

    Returns:
        LMSService instance
    """
    return LMSService(storage_service)
