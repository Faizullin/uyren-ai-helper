"""Educational AI Threads Router.

Provides thread management functionality specific to the educational AI module,
including filtering by target_type.
"""

import uuid

from fastapi import APIRouter, Depends, Query
from sqlmodel import func, select

from app.core.db import SessionDep
from app.core.logger import logger
from app.models import Thread
from app.schemas.common import (
    PaginatedResponse,
    PaginationQueryParams,
    create_paginated_response,
    get_pagination_params,
    paginate_query,
)
from app.schemas.thread import ThreadPublic
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["edu-ai"])


@router.get(
    "/threads",
    response_model=PaginatedResponse[ThreadPublic],
    tags=["edu-ai-threads"],
    summary="List Educational AI Threads",
    operation_id="list_edu_ai_threads",
)
async def list_edu_ai_threads(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID = Query(..., description="Project ID to filter threads"),
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[ThreadPublic]:
    """
    Get threads for educational AI module filtered by project.

    This endpoint returns threads for a specific project with target_type "edu_ai_task".

    Args:
        project_id: Required project ID to filter threads
        pagination: Standard pagination parameters

    Returns:
        Paginated list of edu_ai_task threads for the project
    """
    target_type = "edu_ai_task"
    logger.debug(
        f"Fetching edu_ai threads for user: {current_user.id}, project: {project_id}, target_type: {target_type}"
    )

    # Build query with project and target_type filters
    query = select(Thread).where(
        Thread.owner_id == current_user.id,
        Thread.project_id == project_id,
        Thread.target_type == target_type
    )
    count_query = (
        select(func.count())
        .select_from(Thread)
        .where(
            Thread.owner_id == current_user.id,
            Thread.project_id == project_id,
            Thread.target_type == target_type
        )
    )

    # Order by updated_at descending (most recent first)
    query = query.order_by(Thread.updated_at.desc())

    # Execute pagination
    results, total = paginate_query(session, query, count_query, pagination)
    threads = [ThreadPublic.model_validate(thread) for thread in results]

    logger.debug(f"Found {len(threads)} edu_ai threads (total: {total})")

    return create_paginated_response(threads, pagination, total)
