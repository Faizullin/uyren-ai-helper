"""
Autograder Router for Educational AI module.

Handles automated assignment grading with AI-powered evaluation.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import select

from app.core import redis
from app.core.db import SessionDep
from app.core.logger import logger
from app.models import AgentRun, AgentRunStatus, Project, Thread
from app.modules.edu_ai import tasks as edu_ai_tasks
from app.schemas.agent_run import AgentStartResponse
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["autograder"])


class RubricCriterion(BaseModel):
    """Rubric criterion definition."""

    name: str = Field(..., description="Criterion name")
    description: str = Field(..., description="What to evaluate")
    max_points: float = Field(..., gt=0, description="Maximum points for this criterion")


class AutograderRequest(BaseModel):
    """Request model for autograder."""

    project_id: uuid.UUID = Field(..., description="Project ID")
    assignment_id: str = Field(..., description="Assignment identifier")
    submission_content: str = Field(..., min_length=1, description="Student submission content")
    rubric: dict[str, RubricCriterion] = Field(
        ...,
        description="Grading rubric with criteria",
        example={
            "code_quality": {
                "name": "Code Quality",
                "description": "Clean, readable, well-structured code",
                "max_points": 30,
            },
            "functionality": {
                "name": "Functionality",
                "description": "All requirements implemented correctly",
                "max_points": 40,
            },
            "documentation": {
                "name": "Documentation",
                "description": "Clear comments and documentation",
                "max_points": 30,
            },
        },
    )
    use_ai_grading: bool = Field(
        default=True,
        description="Use AI for detailed grading (default: True). If False, uses simulated scoring.",
    )
    model_name: str | None = Field(
        default=None,
        description="AI model to use for grading (e.g., 'gpt-4', 'gpt-4o-mini'). Defaults to 'gpt-4o-mini'.",
    )


@router.post(
    "/autograder/start",
    response_model=AgentStartResponse,
    summary="Start Autograder Task",
    operation_id="start_autograder",
)
async def start_autograder(
    request: AutograderRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> AgentStartResponse:
    """
    Start an automated grading task for an assignment submission.

    This endpoint:
    1. Validates project access
    2. Creates Thread and AgentRun for tracking
    3. Registers in Redis
    4. Triggers autograder background task
    5. Returns run information for monitoring

    The autograder will:
    - Analyze submission content
    - Evaluate against rubric criteria
    - Generate detailed feedback
    - Calculate final score and grade

    Use the `/agent-run/{agent_run_id}/stream` endpoint to monitor progress in real-time.
    """
    logger.debug(
        f"[AUTOGRADER_ROUTER] Starting autograder for assignment '{request.assignment_id}'"
    )

    try:
        # 1. Validate project exists and user has access
        statement = select(Project).where(
            Project.id == request.project_id,
            Project.owner_id == current_user.id,
        )
        project = session.exec(statement).first()

        if not project:
            raise HTTPException(
                status_code=404,
                detail=f"Project {request.project_id} not found or access denied",
            )

        # 2. Create thread for autograding
        thread = Thread(
            title=f"Autograder: {request.assignment_id}",
            description=f"Automated grading for assignment {request.assignment_id}",
            owner_id=current_user.id,
            project_id=project.id,
            target_type="autograder",
        )
        session.add(thread)
        session.flush()

        # 3. Convert rubric to dict format
        rubric_dict = {
            key: {
                "name": criterion.name,
                "description": criterion.description,
                "max_points": criterion.max_points,
            }
            for key, criterion in request.rubric.items()
        }

        # Determine AI model
        model_name = request.model_name or "gpt-4o-mini"

        # 4. Create AgentRun record with grading configuration
        agent_run = AgentRun(
            thread_id=thread.id,
            agent_id=None,  # Autograder doesn't use a specific agent
            agent_version_id=None,
            status=AgentRunStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
            my_metadata={
                "actor_name": "autograder_task",
                "assignment_id": request.assignment_id,
                "task_type": "autograder",
                "use_ai_grading": request.use_ai_grading,
                "model_name": model_name,
                "rubric_criteria_count": len(rubric_dict),
                "submission_length": len(request.submission_content),
            },
        )
        session.add(agent_run)
        session.commit()
        session.refresh(agent_run)

        logger.info(
            f"[AUTOGRADER_ROUTER] Created agent run {agent_run.id} for autograder"
        )

        # 5. Register in Redis for tracking
        instance_key = f"active_run:autograder:{agent_run.id}"
        try:
            await redis.set(instance_key, "running", ex=redis.REDIS_KEY_TTL)
            logger.debug(f"Registered autograder run in Redis: {instance_key}")
        except Exception as e:
            logger.warning(f"Failed to register in Redis: {e}")

        # 6. Trigger background autograder task
        edu_ai_tasks.autograder_task.send(
            agent_run_id=str(agent_run.id),
            thread_id=str(thread.id),
            assignment_id=request.assignment_id,
            submission_content=request.submission_content,
            rubric=rubric_dict,
        )

        logger.info(
            f"[AUTOGRADER_ROUTER] Autograder task dispatched for agent run {agent_run.id}"
        )

        return AgentStartResponse(
            agent_run_id=agent_run.id,
            thread_id=thread.id,
            project_id=project.id,
            model_name="autograder_ai",
            agent_name=f"Autograder: {request.assignment_id}",
            status="running",
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Failed to start autograder: {str(e)}"
        logger.error(f"[AUTOGRADER_ROUTER] {error_msg}", exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)

