"""API Key routes."""

import hashlib
import secrets
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import func, select

from app.core.db import SessionDep
from app.core.logger import logger
from app.models import APIKey, Project
from app.schemas.api_key import (
    APIKeyCreate,
    APIKeyDetail,
    APIKeyGenerateResponse,
    APIKeyPublic,
    APIKeyUpdate,
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

router = APIRouter(tags=["api-keys"])


# ==================== Helper Functions ====================


def verify_project_exists(
    session: SessionDep, project_id: uuid.UUID, current_user: CurrentUser
) -> Project:
    """Verify project exists and user has access to it."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check ownership
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this project"
        )

    return project


def verify_api_key_ownership(
    session: SessionDep, api_key_id: uuid.UUID, current_user: CurrentUser
) -> APIKey:
    """Verify user owns the API key."""
    api_key = session.get(APIKey, api_key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")

    if api_key.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this API key"
        )

    return api_key


# ==================== API Key CRUD Endpoints ====================


@router.get(
    "/api-keys",
    response_model=PaginatedResponse[APIKeyPublic],
    summary="List API Keys",
    operation_id="list_api_keys",
)
async def list_api_keys(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID | None = None,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[APIKeyPublic]:
    """List user's API keys, optionally filtered by project."""
    query = select(APIKey).where(APIKey.owner_id == current_user.id)
    count_query = (
        select(func.count())
        .select_from(APIKey)
        .where(APIKey.owner_id == current_user.id)
    )

    # Filter by project if specified
    if project_id:
        # Verify project exists and user has access
        verify_project_exists(session, project_id, current_user)
        query = query.where(APIKey.project_id == project_id)
        count_query = count_query.where(APIKey.project_id == project_id)

    query = query.order_by(APIKey.created_at.desc())

    results, total = paginate_query(session, query, count_query, pagination)

    # Convert to public schemas
    api_keys = [APIKeyPublic.model_validate(api_key) for api_key in results]

    return create_paginated_response(api_keys, pagination, total)


@router.get(
    "/api-keys/{api_key_id}",
    response_model=APIKeyDetail,
    summary="Get API Key",
    operation_id="get_api_key",
)
async def get_api_key(
    api_key_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> APIKeyDetail:
    """Get a specific API key by ID."""
    api_key = verify_api_key_ownership(session, api_key_id, current_user)
    return APIKeyDetail.model_validate(api_key)


@router.post(
    "/api-keys",
    response_model=APIKeyGenerateResponse,
    summary="Create API Key",
    operation_id="create_api_key",
)
async def create_api_key(
    api_key_data: APIKeyCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> APIKeyGenerateResponse:
    """Create a new API key."""
    # Verify project exists if project_id is provided
    if api_key_data.project_id:
        verify_project_exists(session, api_key_data.project_id, current_user)

    # Generate API key
    public_key = f"pk_{secrets.token_urlsafe(16)}"
    secret_key = f"sk_{secrets.token_urlsafe(32)}"
    secret_key_hash = hashlib.sha256(secret_key.encode()).hexdigest()

    # Create API key
    api_key = APIKey(
        public_key=public_key,
        secret_key_hash=secret_key_hash,
        owner_id=current_user.id,
        project_id=api_key_data.project_id,
        title=api_key_data.title,
        description=api_key_data.description,
        expires_at=api_key_data.expires_at,
    )

    session.add(api_key)
    session.commit()
    session.refresh(api_key)

    logger.info(f"Created API key {api_key.id} for user {current_user.id}")

    return APIKeyGenerateResponse(
        id=api_key.id,
        public_key=api_key.public_key,
        secret_key=secret_key,  # Only returned once during creation
        title=api_key.title,
        description=api_key.description,
        project_id=api_key.project_id,
        expires_at=api_key.expires_at,
        created_at=api_key.created_at,
    )


@router.put(
    "/api-keys/{api_key_id}",
    response_model=APIKeyPublic,
    summary="Update API Key",
    operation_id="update_api_key",
)
async def update_api_key(
    api_key_id: uuid.UUID,
    api_key_data: APIKeyUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> APIKeyPublic:
    """Update an existing API key."""
    api_key = verify_api_key_ownership(session, api_key_id, current_user)

    # Verify project exists if project_id is being updated
    if api_key_data.project_id is not None:
        verify_project_exists(session, api_key_data.project_id, current_user)

    # Update fields
    update_data = api_key_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(api_key, field, value)

    api_key.updated_at = datetime.now(timezone.utc)

    session.add(api_key)
    session.commit()
    session.refresh(api_key)

    logger.info(f"Updated API key {api_key.id} for user {current_user.id}")

    return APIKeyPublic.model_validate(api_key)


@router.delete(
    "/api-keys/{api_key_id}",
    response_model=Message,
    summary="Delete API Key",
    operation_id="delete_api_key",
)
async def delete_api_key(
    api_key_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete an API key."""
    api_key = verify_api_key_ownership(session, api_key_id, current_user)

    session.delete(api_key)
    session.commit()

    logger.info(f"Deleted API key {api_key_id} for user {current_user.id}")

    return Message(message="API key deleted successfully")


@router.get(
    "/projects/{project_id}/api-keys",
    response_model=PaginatedResponse[APIKeyPublic],
    summary="Get Project API Keys",
    operation_id="get_project_api_keys",
)
async def get_project_api_keys(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[APIKeyPublic]:
    """Get all API keys for a specific project."""
    # Verify project exists and user has access
    verify_project_exists(session, project_id, current_user)

    query = select(APIKey).where(
        APIKey.owner_id == current_user.id, APIKey.project_id == project_id
    )
    count_query = (
        select(func.count())
        .select_from(APIKey)
        .where(APIKey.owner_id == current_user.id, APIKey.project_id == project_id)
    )

    query = query.order_by(APIKey.created_at.desc())

    results, total = paginate_query(session, query, count_query, pagination)

    # Convert to public schemas
    api_keys = [APIKeyPublic.model_validate(api_key) for api_key in results]

    return create_paginated_response(api_keys, pagination, total)
