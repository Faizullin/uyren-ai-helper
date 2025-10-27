"""
RAG Chatbot Router for LMS Resources

Simplified router for RAG chatbot setup:
- Start RAG embeddings generation for LMS resources
- Uses project API keys for OpenAI
- Enables RAG-based chatbot queries
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
from app.modules.edu_ai.models import LMSResource
from app.schemas.agent_run import AgentStartResponse
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["rag-chatbot"])


class RAGStartRequest(BaseModel):
    """Request model for starting RAG chatbot."""

    project_id: uuid.UUID = Field(..., description="Project ID")
    lms_resource_id: uuid.UUID = Field(..., description="LMS Resource ID (course/lesson)")
    vector_store_id: uuid.UUID | None = Field(
        default=None,
        description="Existing vector store ID (optional). If not provided, creates new store.",
    )
    create_new_store: bool = Field(
        default=False,
        description="Force creation of new vector store even if one exists",
    )


@router.post(
    "/rag-chatbot/start",
    response_model=AgentStartResponse,
    summary="Start RAG Chatbot for LMS Resource",
    operation_id="start_rag_chatbot",
)
async def start_rag_chatbot(
    request: RAGStartRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> AgentStartResponse:
    """
    Start RAG chatbot setup for an LMS resource (course/lesson).

    This endpoint:
    1. Validates project and LMS resource access
    2. Creates or uses existing vector store
    3. Uses project API key for OpenAI embeddings
    4. Creates Thread and AgentRun for tracking
    5. Triggers background task to:
       - Fetch LMS resource content
       - Chunk content using LangChain
       - Generate embeddings with project API key
       - Store in vector store
    6. Returns run information for monitoring

    Use the `/agent-run/{agent_run_id}/stream` endpoint to monitor progress in real-time.
    """
    logger.debug(
        f"[RAG_CHATBOT_ROUTER] Starting RAG for LMS resource {request.lms_resource_id}"
    )

    try:
        # 1. Validate project access
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

        # 2. Validate LMS resource access
        lms_statement = select(LMSResource).where(
            LMSResource.id == request.lms_resource_id,
            LMSResource.owner_id == current_user.id,
        )
        lms_resource = session.exec(lms_statement).first()

        if not lms_resource:
            raise HTTPException(
                status_code=404,
                detail=f"LMS resource {request.lms_resource_id} not found or access denied",
            )

        # 3. Check if vector store exists or should be created
        vector_store_id = request.vector_store_id

        if not vector_store_id and not request.create_new_store:
            # Try to find existing vector store from LMS resource metadata
            rag_config = lms_resource.my_metadata.get("rag_config", {})
            vector_store_id = rag_config.get("vector_store_id")

        # 4. Create thread for RAG setup
        thread = Thread(
            title=f"RAG Setup: {lms_resource.title}",
            description=f"Setting up RAG chatbot for {lms_resource.target_type}: {lms_resource.title}",
            owner_id=current_user.id,
            project_id=project.id,
            target_type="rag_chatbot",
        )
        session.add(thread)
        session.flush()

        # 5. Create AgentRun record
        agent_run = AgentRun(
            thread_id=thread.id,
            agent_id=None,
            agent_version_id=None,
            status=AgentRunStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
            my_metadata={
                "actor_name": "rag_chatbot_task",
                "task_type": "rag_setup",
                "lms_resource_id": str(request.lms_resource_id),
                "lms_resource_title": lms_resource.title,
                "lms_resource_type": lms_resource.target_type,
                "vector_store_id": str(vector_store_id) if vector_store_id else None,
                "create_new_store": request.create_new_store,
            },
        )
        session.add(agent_run)
        session.commit()
        session.refresh(agent_run)

        logger.info(
            f"[RAG_CHATBOT_ROUTER] Created agent run {agent_run.id} for RAG setup"
        )

        # 6. Register in Redis
        instance_key = f"active_run:rag_chatbot:{agent_run.id}"
        try:
            await redis.set(instance_key, "running", ex=redis.REDIS_KEY_TTL)
            logger.debug(f"Registered RAG chatbot run in Redis: {instance_key}")
        except Exception as e:
            logger.warning(f"Failed to register in Redis: {e}")

        # 7. Trigger background RAG setup task
        edu_ai_tasks.rag_chatbot_task.send(
            agent_run_id=str(agent_run.id),
            thread_id=str(thread.id),
            lms_resource_id=str(request.lms_resource_id),
            vector_store_id=str(vector_store_id) if vector_store_id else None,
            create_vector_store=request.create_new_store,
            project_id=str(request.project_id),
        )

        logger.info(
            f"[RAG_CHATBOT_ROUTER] RAG setup task dispatched for agent run {agent_run.id}"
        )

        return AgentStartResponse(
            agent_run_id=agent_run.id,
            thread_id=thread.id,
            project_id=project.id,
            model_name="rag_embeddings",
            agent_name=f"RAG Setup: {lms_resource.title}",
            status="running",
        )

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Failed to start RAG chatbot: {str(e)}"
        logger.error(f"[RAG_CHATBOT_ROUTER] {error_msg}", exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)



