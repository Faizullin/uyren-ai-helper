"""
Simple Demo Tasks for Educational AI
Follows agent_runs pattern with AgentRun tracking
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, TypedDict

import dramatiq
from langgraph.graph import END, StateGraph
from sqlmodel import select

from app.core import redis
from app.core.db import get_db
from app.core.logger import logger
from app.models import AgentRun, AgentRunStatus, Project, User


class DemoState(TypedDict):
    """Simple state for demo workflow"""

    user_id: str
    project_id: str
    task_name: str
    step_count: int
    result: str
    status: str


async def demo_step_1(state: DemoState) -> DemoState:
    """Step 1: Initialize demo processing"""
    logger.info(f"[DEMO_TASK] Step 1: Initializing demo task '{state['task_name']}'")

    await asyncio.sleep(2)  # Simulate processing time

    return {
        **state,
        "step_count": state["step_count"] + 1,
        "status": "processing",
    }


async def demo_step_2(state: DemoState) -> DemoState:
    """Step 2: Simulate AI processing"""
    logger.info("[DEMO_TASK] Step 2: Running AI simulation")

    await asyncio.sleep(3)  # Simulate AI processing

    return {
        **state,
        "step_count": state["step_count"] + 1,
        "status": "analyzing",
    }


async def demo_step_3(state: DemoState) -> DemoState:
    """Step 3: Generate results"""
    logger.info("[DEMO_TASK] Step 3: Generating results")

    await asyncio.sleep(2)  # Simulate result generation

    return {
        **state,
        "step_count": state["step_count"] + 1,
        "result": f"Demo task '{state['task_name']}' completed successfully with {state['step_count'] + 1} steps",
        "status": "completed",
    }


def create_demo_graph():
    """Create simple demo workflow graph inline"""
    workflow = StateGraph(DemoState)

    # Add nodes
    workflow.add_node("step_1", demo_step_1)
    workflow.add_node("step_2", demo_step_2)
    workflow.add_node("step_3", demo_step_3)

    # Add edges
    workflow.set_entry_point("step_1")
    workflow.add_edge("step_1", "step_2")
    workflow.add_edge("step_2", "step_3")
    workflow.add_edge("step_3", END)

    return workflow.compile()


@dramatiq.actor(max_retries=3, time_limit=300_000)  # 5 minute timeout
def demo_educational_task(
    user_id: str,
    project_id: str,
    task_name: str = "demo_processing",
) -> dict[str, Any]:
    """
    Demo educational AI processing task following agent_runs pattern.

    This task demonstrates:
    1. User and project validation
    2. AgentRun status tracking
    3. Simple LangGraph workflow execution
    4. Clean error handling and logging

    Args:
        user_id: User ID for validation
        project_id: Project ID for context
        task_name: Name of the demo task

    Returns:
        Dict containing processing results
    """
    logger.info(
        f"[DEMO_TASK] Starting demo task '{task_name}' for user {user_id}, project {project_id}"
    )

    task_start_time = datetime.now(timezone.utc)
    task_id = str(uuid.uuid4())

    try:
        # Run async database operations
        return asyncio.run(
            _run_demo_task_async(
                user_id, project_id, task_name, task_start_time, task_id
            )
        )
    except Exception as e:
        error_msg = f"Error in demo task: {str(e)}"
        logger.error(f"[DEMO_TASK] {error_msg}", exc_info=True)
        return {
            "task_id": task_id,
            "status": "failed",
            "user_id": user_id,
            "project_id": project_id,
            "task_name": task_name,
            "error": error_msg,
            "started_at": task_start_time.isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }


async def _run_demo_task_async(
    user_id: str,
    project_id: str,
    task_name: str,
    task_start_time: datetime,
    task_id: str,
) -> dict[str, Any]:
    """Async helper function for demo task execution."""
    async with get_db() as session:
        # 1. Validate user and project
        user = session.get(User, uuid.UUID(user_id))
        project = session.get(Project, uuid.UUID(project_id))

        if not user:
            raise ValueError(f"User {user_id} not found")
        if not project:
            raise ValueError(f"Project {project_id} not found")

        logger.info(
            f"[DEMO_TASK] Validated user: {user.email}, project: {project.name}"
        )

        # 2. Find the AgentRun record for this demo task
        statement = select(AgentRun).where(
            AgentRun.my_metadata.contains({"task_name": task_name}),
            AgentRun.my_metadata.contains({"user_id": user_id}),
            AgentRun.my_metadata.contains({"project_id": project_id}),
            AgentRun.status == AgentRunStatus.RUNNING,
        )
        agent_run = session.exec(statement).first()

        if not agent_run:
            raise ValueError(f"No running AgentRun found for demo task '{task_name}'")

        logger.info(f"[DEMO_TASK] Found AgentRun: {agent_run.id}")

        # 3. Create initial state for demo workflow
        initial_state: DemoState = {
            "user_id": user_id,
            "project_id": project_id,
            "task_name": task_name,
            "step_count": 0,
            "result": "",
            "status": "starting",
        }

        # 4. Run demo workflow
        logger.info("[DEMO_TASK] Starting demo workflow execution")

        try:
            # Create and run the demo graph
            demo_graph = create_demo_graph()
            final_state = await demo_graph.ainvoke(initial_state)

            logger.info("[DEMO_TASK] Demo workflow completed successfully")

        except Exception as workflow_error:
            logger.warning(f"[DEMO_TASK] Demo workflow failed: {workflow_error}")

            # Simple fallback simulation
            await asyncio.sleep(5)  # Simulate processing
            final_state = {
                **initial_state,
                "step_count": 3,
                "result": f"Demo task '{task_name}' completed (fallback mode)",
                "status": "completed",
            }

        # 5. Update AgentRun status (following agent_runs pattern)
        agent_run.status = AgentRunStatus.COMPLETED
        agent_run.completed_at = datetime.now(timezone.utc)
        agent_run.updated_at = datetime.now(timezone.utc)

        # Update metadata with results
        agent_run.my_metadata.update(
            {
                "task_completed_at": datetime.now(timezone.utc).isoformat(),
                "workflow_result": final_state["result"],
                "step_count": final_state["step_count"],
                "processing_duration": (
                    datetime.now(timezone.utc) - task_start_time
                ).total_seconds(),
            }
        )

        session.add(agent_run)
        await session.commit()

        # Clean up Redis tracking (following backend_suna pattern)
        instance_key = f"active_run:demo:{agent_run.id}"
        try:
            await redis.delete(instance_key)
            logger.debug(f"Cleaned up Redis key: {instance_key}")
        except Exception as e:
            logger.warning(f"Failed to cleanup Redis key: {e}")

        task_end_time = datetime.now(timezone.utc)
        processing_duration = (task_end_time - task_start_time).total_seconds()

        logger.info(f"[DEMO_TASK] Completed demo task in {processing_duration:.2f}s")

        return {
            "task_id": task_id,
            "agent_run_id": str(agent_run.id),
            "status": "completed",
            "user_id": user_id,
            "project_id": project_id,
            "task_name": task_name,
            "workflow_result": final_state["result"],
            "step_count": final_state["step_count"],
            "processing_duration_seconds": processing_duration,
            "started_at": task_start_time.isoformat(),
            "completed_at": task_end_time.isoformat(),
        }


__all__ = ["demo_educational_task"]
