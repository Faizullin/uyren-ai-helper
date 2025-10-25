"""
Demo Tasks Router for Educational AI module.
Follows agent_runs pattern for consistency.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import select

from app.core import redis
from app.core.db import SessionDep
from app.core.logger import logger
from app.models import AgentRun, AgentRunStatus, Project, Thread
from app.schemas.agent_run import AgentStartResponse
from app.tasks import edu_ai_tasks
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["demo-tasks"])


@router.post(
    "/demo/start",
    response_model=AgentStartResponse,
    summary="Start Demo Educational Task",
    operation_id="start_demo_educational_task",
)
async def start_demo_task(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: uuid.UUID = Query(..., description="Project ID for the demo task"),
    task_name: str = Query("demo_processing", description="Name of the demo task"),
) -> AgentStartResponse:
    """
    Start a demo educational AI processing task in the background.

    This endpoint follows the agent_runs pattern:
    1. User and project validation
    2. Creates Thread and AgentRun records for tracking
    3. Registers in Redis for distributed tracking
    4. Triggers background task with dramatiq
    5. Returns run information for monitoring

    Args:
        project_id: The project ID for context
        task_name: Optional name for the demo task

    Returns:
        Task information and status
    """
    logger.debug(
        f"[DEMO_ROUTER] Starting demo task '{task_name}' for project: {project_id}"
    )

    try:
        # 1. Validate that the project exists and user has access
        statement = select(Project).where(
            Project.id == project_id, Project.owner_id == current_user.id
        )
        project = session.exec(statement).first()

        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Project {project_id} not found or access denied",
            )

        # 2. Create a thread for the demo task (similar to agent_runs)
        thread = Thread(
            title=f"Demo Task: {task_name}",
            description="Demo educational AI processing task",
            owner_id=current_user.id,
            project_id=project.id,
            target_type="edu_ai_task",
        )
        session.add(thread)
        session.flush()  # Get thread ID without committing

        # 3. Create AgentRun record for tracking (following agent_runs pattern)
        agent_run = AgentRun(
            thread_id=thread.id,
            agent_id=None,  # Demo task doesn't use a specific agent
            agent_version_id=None,
            status=AgentRunStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
            my_metadata={
                "task_name": task_name,
                "task_type": "demo_educational",
                "user_id": str(current_user.id),
                "project_id": str(project_id),
                "model_name": "demo_model",  # Following backend_suna pattern
            },
        )
        session.add(agent_run)
        session.commit()
        session.refresh(agent_run)

        logger.info(f"[DEMO_ROUTER] Created agent run {agent_run.id} for demo task")

        # 4. Register run in Redis for tracking (following backend_suna pattern)
        instance_key = f"active_run:demo:{agent_run.id}"
        try:
            await redis.set(instance_key, "running", ex=redis.REDIS_KEY_TTL)
            logger.debug(f"Registered demo run in Redis: {instance_key}")
        except Exception as e:
            logger.warning(f"Failed to register in Redis: {e}")

        # 5. Trigger the background task
        edu_ai_tasks.demo_educational_task.send(
            user_id=str(current_user.id),
            project_id=str(project_id),
            task_name=task_name,
        )

        logger.info(f"[DEMO_ROUTER] Demo task dispatched for agent run {agent_run.id}")

        return AgentStartResponse(
            agent_run_id=agent_run.id,
            thread_id=thread.id,
            project_id=project.id,
            model_name="demo_model",
            agent_name=f"Demo Task: {task_name}",
            status="running",
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Failed to start demo task: {str(e)}"
        logger.error(f"[DEMO_ROUTER] {error_msg}", exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)
