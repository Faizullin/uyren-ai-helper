"""Project routes."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import func, select

from app.core.db import SessionDep
from app.core.logger import logger
from app.models import Project, Thread
from app.schemas.common import (
    Message,
    PaginatedResponse,
    PaginationQueryParams,
    create_paginated_response,
    get_pagination_params,
    paginate_query,
)
from app.schemas.project import ProjectCreate, ProjectPublic, ProjectUpdate
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["projects"])


# ==================== Helper Functions ====================


def verify_project_access(
    session: SessionDep, project_id: uuid.UUID, current_user: CurrentUser
) -> Project:
    """Verify user has access to project."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Check ownership or public access
    if project.owner_id != current_user.id and not project.is_public:
        raise HTTPException(
            status_code=403, detail="Not authorized to access this project"
        )

    return project


# ==================== Project CRUD Endpoints ====================


@router.get(
    "/projects",
    response_model=PaginatedResponse[ProjectPublic],
    summary="List User Projects",
    operation_id="list_user_projects",
)
async def list_projects(
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
    include_public: bool = Query(
        False, description="Include public projects from other users"
    ),
) -> PaginatedResponse[ProjectPublic]:
    """List projects owned by the user, optionally including public projects."""
    # Build base query for user's projects
    user_query = select(Project).where(Project.owner_id == current_user.id)
    user_count_query = (
        select(func.count())
        .select_from(Project)
        .where(Project.owner_id == current_user.id)
    )

    if include_public:
        # Also include public projects from other users
        public_query = select(Project).where(
            Project.is_public == True,  # noqa: E712
            Project.owner_id != current_user.id,
        )

        # Combine queries
        query = user_query.union(public_query).order_by(Project.created_at.desc())
        count_query = select(func.count()).select_from(
            user_query.union(public_query).subquery()
        )
    else:
        query = user_query.order_by(Project.created_at.desc())
        count_query = user_count_query

    # Execute paginated query
    results, total = paginate_query(session, query, count_query, pagination)

    # Convert to ProjectPublic objects
    project_publics = [ProjectPublic.model_validate(project) for project in results]

    return create_paginated_response(project_publics, pagination, total)


@router.get(
    "/projects/{project_id}",
    response_model=ProjectPublic,
    summary="Get Project",
    operation_id="get_project",
)
async def get_project(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> ProjectPublic:
    """Get a specific project by ID."""
    return verify_project_access(session, project_id, current_user)


@router.post(
    "/projects",
    response_model=ProjectPublic,
    summary="Create Project",
    operation_id="create_project",
)
async def create_project(
    project_data: ProjectCreate,
    session: SessionDep,
    current_user: CurrentUser,
) -> ProjectPublic:
    """Create a new project."""
    logger.info(f"Creating project '{project_data.name}' for user {current_user.id}")

    # Check project creation limits
    from app.modules.limits_checker import check_project_count_limit

    limit_check = await check_project_count_limit(session, current_user.id)
    if not limit_check["can_create"]:
        raise HTTPException(
            status_code=403,
            detail=f"Project creation limit exceeded: {limit_check['message']}",
        )

    project = Project(
        owner_id=current_user.id,
        name=project_data.name,
        description=project_data.description,
        is_public=project_data.is_public,
    )

    session.add(project)
    session.commit()
    session.refresh(project)

    logger.info(f"Created project {project.id} for user {current_user.id}")
    return project


@router.put(
    "/projects/{project_id}",
    response_model=ProjectPublic,
    summary="Update Project",
    operation_id="update_project",
)
async def update_project(
    project_id: uuid.UUID,
    project_data: ProjectUpdate,
    session: SessionDep,
    current_user: CurrentUser,
) -> ProjectPublic:
    """Update an existing project."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify ownership (only owner can update)
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to update this project"
        )

    logger.info(f"Updating project {project_id} for user {current_user.id}")

    # Update fields if provided
    if project_data.name is not None:
        project.name = project_data.name
    if project_data.description is not None:
        project.description = project_data.description
    if project_data.is_public is not None:
        project.is_public = project_data.is_public

    project.updated_at = datetime.now(timezone.utc)
    session.add(project)
    session.commit()
    session.refresh(project)

    logger.info(f"Updated project {project.id}")
    return project


@router.delete(
    "/projects/{project_id}",
    response_model=Message,
    summary="Delete Project",
    operation_id="delete_project",
)
async def delete_project(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete a project and all associated threads."""
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Verify ownership (only owner can delete)
    if project.owner_id != current_user.id:
        raise HTTPException(
            status_code=403, detail="Not authorized to delete this project"
        )

    logger.info(f"Deleting project {project_id} for user {current_user.id}")

    # Count threads that will be deleted
    thread_count = session.exec(
        select(func.count(Thread.id)).where(Thread.project_id == project_id)
    ).one()

    # Delete the project (cascade will handle threads and messages)
    session.delete(project)
    session.commit()

    logger.info(f"Deleted project {project_id} and {thread_count} associated threads")
    return Message(
        message=f"Project deleted successfully. {thread_count} threads were also deleted."
    )


# ==================== Project Threads Endpoint ====================


@router.get(
    "/projects/{project_id}/threads",
    response_model=PaginatedResponse[Thread],
    summary="Get Project Threads",
    operation_id="get_project_threads",
)
async def get_project_threads(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
) -> PaginatedResponse[Thread]:
    """Get all threads belonging to a specific project."""
    # Verify project access
    project = verify_project_access(session, project_id, current_user)

    logger.info(f"Getting threads for project {project_id} (user: {current_user.id})")

    # Build query for threads in this project
    query = select(Thread).where(Thread.project_id == project_id)
    count_query = select(func.count()).select_from(Thread).where(Thread.project_id == project_id)

    # If not the owner, only show threads they have access to
    if project.owner_id != current_user.id:
        # For public projects, only show threads owned by the current user
        query = query.where(Thread.owner_id == current_user.id)
        count_query = count_query.where(Thread.owner_id == current_user.id)

    query = query.order_by(Thread.created_at.desc())

    # Execute paginated query
    results, total = paginate_query(session, query, count_query, pagination)

    return create_paginated_response(results, pagination, total)


# ==================== Project Statistics Endpoint ====================


@router.get(
    "/projects/{project_id}/stats",
    summary="Get Project Statistics",
    operation_id="get_project_stats",
)
async def get_project_stats(
    project_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict:
    """Get statistics for a project."""
    # Verify project access
    project = verify_project_access(session, project_id, current_user)

    # Count threads in this project
    thread_count = session.exec(
        select(func.count(Thread.id)).where(Thread.project_id == project_id)
    ).one()

    # Count messages across all threads in this project
    message_count = session.exec(
        select(func.count())
        .select_from(Thread)
        .join(Thread.messages)
        .where(Thread.project_id == project_id)
    ).one()

    return {
        "project_id": str(project_id),
        "project_name": project.name,
        "thread_count": thread_count,
        "message_count": message_count,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }
