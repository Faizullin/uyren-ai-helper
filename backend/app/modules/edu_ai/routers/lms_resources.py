"""LMS Resources router for Educational AI module."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import select

from app.core.db import SessionDep
from app.core.logger import logger
from app.modules.edu_ai.models import LMSResource, LMSResourceAttachment
from app.modules.edu_ai.schemas import (
    LMSResourceAttachmentCreate,
    LMSResourceAttachmentPublic,
    LMSResourceAttachmentUpdate,
    LMSResourceCreate,
    LMSResourcePublic,
    LMSResourceUpdate,
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

router = APIRouter(prefix="/lms-resources", tags=["lms-resources"])


@router.get(
    "",
    response_model=PaginatedResponse[LMSResourcePublic],
    summary="Get User LMS Resources",
    operation_id="get_user_lms_resources",
)
async def get_user_lms_resources(
    session: SessionDep,
    current_user: CurrentUser,
    course_id: str | None = Query(default=None, description="Filter by course ID"),
    target_type: str | None = Query(default=None, description="Filter by target type"),
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[LMSResourcePublic]:
    """Get LMS resources for the current user."""
    try:
        query = select(LMSResource).where(LMSResource.owner_id == current_user.id)

        if course_id:
            query = query.where(
                LMSResource.my_metadata["course_id"].astext == course_id
            )

        if target_type:
            query = query.where(LMSResource.target_type == target_type)

        count_query = (
            select()
            .select_from(LMSResource)
            .where(LMSResource.owner_id == current_user.id)
        )

        if course_id:
            count_query = count_query.where(
                LMSResource.my_metadata["course_id"].astext == course_id
            )

        if target_type:
            count_query = count_query.where(LMSResource.target_type == target_type)

        query = query.order_by(LMSResource.created_at.desc())

        results, total = paginate_query(session, query, count_query, pagination)

        resources = [LMSResourcePublic.model_validate(resource) for resource in results]

        return create_paginated_response(resources, pagination, total)

    except Exception as e:
        logger.error(
            f"Error getting LMS resources for user {current_user.id}: {str(e)}"
        )
        raise HTTPException(status_code=500, detail="Failed to get LMS resources")


@router.get(
    "/{resource_id}",
    response_model=LMSResourcePublic,
    summary="Get LMS Resource",
    operation_id="get_lms_resource",
)
async def get_lms_resource(
    resource_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> LMSResourcePublic:
    """Get a specific LMS resource by ID."""
    try:
        query = select(LMSResource).where(
            LMSResource.id == resource_id, LMSResource.owner_id == current_user.id
        )

        resource = session.exec(query).first()

        if not resource:
            raise HTTPException(status_code=404, detail="LMS resource not found")

        return LMSResourcePublic.model_validate(resource)

    except Exception as e:
        logger.error(f"Error getting resource {resource_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get LMS resource")


@router.post(
    "",
    response_model=LMSResourcePublic,
    summary="Create LMS Resource",
    operation_id="create_lms_resource",
)
async def create_lms_resource(
    resource_data: LMSResourceCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> LMSResourcePublic:
    """Create a new LMS resource."""
    try:
        resource = LMSResource(
            owner_id=current_user.id,
            title=resource_data.title,
            description=resource_data.description,
            content=resource_data.content,
            thumbnail_url=resource_data.thumbnail_url,
            target_type=resource_data.target_type,
            target_id=resource_data.target_id,
            my_metadata=resource_data.my_metadata,
            status=resource_data.status,
            is_public=resource_data.is_public,
        )

        session.add(resource)
        session.commit()
        session.refresh(resource)

        logger.info(f"Created LMS resource {resource.id} for user {current_user.id}")

        return LMSResourcePublic.model_validate(resource)

    except Exception as e:
        session.rollback()
        logger.error(f"Error creating LMS resource: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to create LMS resource")


@router.put(
    "/{resource_id}",
    response_model=LMSResourcePublic,
    summary="Update LMS Resource",
    operation_id="update_lms_resource",
)
async def update_lms_resource(
    resource_id: uuid.UUID,
    resource_data: LMSResourceUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> LMSResourcePublic:
    """Update an existing LMS resource."""
    try:
        query = select(LMSResource).where(
            LMSResource.id == resource_id, LMSResource.owner_id == current_user.id
        )

        resource = session.exec(query).first()

        if not resource:
            raise HTTPException(status_code=404, detail="LMS resource not found")

        # Update fields
        update_data = resource_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(resource, key, value)

        resource.updated_at = datetime.now(timezone.utc)

        session.add(resource)
        session.commit()
        session.refresh(resource)

        logger.info(f"Updated LMS resource {resource_id}")

        return LMSResourcePublic.model_validate(resource)

    except Exception as e:
        session.rollback()
        logger.error(f"Error updating resource {resource_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update LMS resource")


@router.delete(
    "/{resource_id}",
    response_model=Message,
    summary="Delete LMS Resource",
    operation_id="delete_lms_resource",
)
async def delete_lms_resource(
    resource_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete a specific LMS resource by ID."""
    try:
        query = select(LMSResource).where(
            LMSResource.id == resource_id, LMSResource.owner_id == current_user.id
        )

        resource = session.exec(query).first()

        if not resource:
            raise HTTPException(status_code=404, detail="LMS resource not found")

        session.delete(resource)
        session.commit()

        logger.info(f"Successfully deleted resource {resource_id}")

        return Message(message="LMS resource deleted successfully")

    except Exception as e:
        session.rollback()
        logger.error(f"Error deleting resource {resource_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete LMS resource")


# Resource Attachment Routes
@router.get(
    "/{resource_id}/attachments",
    response_model=PaginatedResponse[LMSResourceAttachmentPublic],
    summary="List Resource Attachments",
    operation_id="list_resource_attachments",
)
async def list_resource_attachments(
    resource_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[LMSResourceAttachmentPublic]:
    """List all attachments for a specific LMS resource."""
    try:
        # Verify resource exists and user has access
        query = select(LMSResource).where(
            LMSResource.id == resource_id, LMSResource.owner_id == current_user.id
        )
        resource = session.exec(query).first()

        if not resource:
            raise HTTPException(status_code=404, detail="LMS resource not found")

        # Get attachments
        query = select(LMSResourceAttachment).where(
            LMSResourceAttachment.lms_resource_id == resource_id,
            LMSResourceAttachment.owner_id == current_user.id,
            LMSResourceAttachment.status == "active",
        )

        count_query = (
            select()
            .select_from(LMSResourceAttachment)
            .where(
                LMSResourceAttachment.lms_resource_id == resource_id,
                LMSResourceAttachment.owner_id == current_user.id,
                LMSResourceAttachment.status == "active",
            )
        )

        query = query.order_by(LMSResourceAttachment.created_at.desc())

        results, total = paginate_query(session, query, count_query, pagination)

        attachments = [
            LMSResourceAttachmentPublic.model_validate(attachment)
            for attachment in results
        ]

        return create_paginated_response(attachments, pagination, total)

    except Exception as e:
        logger.error(f"Error getting attachments for resource {resource_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to get resource attachments"
        )


@router.post(
    "/{resource_id}/attachments",
    response_model=LMSResourceAttachmentPublic,
    summary="Create Resource Attachment",
    operation_id="create_resource_attachment",
)
async def create_resource_attachment(
    resource_id: uuid.UUID,
    attachment_data: LMSResourceAttachmentCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> LMSResourceAttachmentPublic:
    """Create a new attachment for an LMS resource."""
    try:
        # Verify resource exists and user has access
        query = select(LMSResource).where(
            LMSResource.id == resource_id, LMSResource.owner_id == current_user.id
        )
        resource = session.exec(query).first()

        if not resource:
            raise HTTPException(status_code=404, detail="LMS resource not found")

        # Create attachment
        attachment = LMSResourceAttachment(
            lms_resource_id=resource_id,
            owner_id=current_user.id,
            title=attachment_data.title,
            description=attachment_data.description,
            file_url=attachment_data.file_url,
            file_name=attachment_data.file_name,
            file_size=attachment_data.file_size,
            content_type=attachment_data.content_type,
            content=attachment_data.content,
            my_metadata=attachment_data.my_metadata,
            status="active",
        )

        session.add(attachment)
        session.commit()
        session.refresh(attachment)

        logger.info(f"Created attachment {attachment.id} for resource {resource_id}")

        return LMSResourceAttachmentPublic.model_validate(attachment)

    except Exception as e:
        session.rollback()
        logger.error(f"Error creating attachment for resource {resource_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to create resource attachment"
        )


@router.get(
    "/attachments/{attachment_id}",
    response_model=LMSResourceAttachmentPublic,
    summary="Get Resource Attachment",
    operation_id="get_resource_attachment",
)
async def get_resource_attachment(
    attachment_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> LMSResourceAttachmentPublic:
    """Get a specific resource attachment by ID."""
    try:
        query = select(LMSResourceAttachment).where(
            LMSResourceAttachment.id == attachment_id,
            LMSResourceAttachment.owner_id == current_user.id,
            LMSResourceAttachment.status == "active",
        )

        attachment = session.exec(query).first()

        if not attachment:
            raise HTTPException(status_code=404, detail="Resource attachment not found")

        return LMSResourceAttachmentPublic.model_validate(attachment)

    except Exception as e:
        logger.error(f"Error getting attachment {attachment_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to get resource attachment")


@router.put(
    "/attachments/{attachment_id}",
    response_model=LMSResourceAttachmentPublic,
    summary="Update Resource Attachment",
    operation_id="update_resource_attachment",
)
async def update_resource_attachment(
    attachment_id: uuid.UUID,
    attachment_data: LMSResourceAttachmentUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> LMSResourceAttachmentPublic:
    """Update an existing resource attachment."""
    try:
        query = select(LMSResourceAttachment).where(
            LMSResourceAttachment.id == attachment_id,
            LMSResourceAttachment.owner_id == current_user.id,
            LMSResourceAttachment.status == "active",
        )

        attachment = session.exec(query).first()

        if not attachment:
            raise HTTPException(status_code=404, detail="Resource attachment not found")

        # Update fields
        update_data = attachment_data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(attachment, key, value)

        attachment.updated_at = datetime.now(timezone.utc)

        session.add(attachment)
        session.commit()
        session.refresh(attachment)

        logger.info(f"Updated attachment {attachment_id}")

        return LMSResourceAttachmentPublic.model_validate(attachment)

    except Exception as e:
        session.rollback()
        logger.error(f"Error updating attachment {attachment_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to update resource attachment"
        )


@router.delete(
    "/attachments/{attachment_id}",
    response_model=Message,
    summary="Delete Resource Attachment",
    operation_id="delete_resource_attachment",
)
async def delete_resource_attachment(
    attachment_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete a specific resource attachment."""
    try:
        query = select(LMSResourceAttachment).where(
            LMSResourceAttachment.id == attachment_id,
            LMSResourceAttachment.owner_id == current_user.id,
            LMSResourceAttachment.status == "active",
        )

        attachment = session.exec(query).first()

        if not attachment:
            raise HTTPException(status_code=404, detail="Resource attachment not found")

        # Soft delete by updating status
        attachment.status = "deleted"
        attachment.updated_at = datetime.now(timezone.utc)

        session.add(attachment)
        session.commit()

        logger.info(f"Deleted attachment {attachment_id}")

        return Message(message="Resource attachment deleted successfully")

    except Exception as e:
        session.rollback()
        logger.error(f"Error deleting attachment {attachment_id}: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to delete resource attachment"
        )
