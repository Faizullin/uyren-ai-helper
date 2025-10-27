"""
Demo Educational AI Task

A demonstration task that shows the complete workflow for:
- AgentRun status tracking
- LangGraph workflow execution
- Real-time SSE streaming via Redis
- Database status updates
- Error handling

This serves as a reference implementation for building new educational AI tasks.
"""

import asyncio
import uuid
from datetime import datetime, timezone
from typing import Any, TypedDict

import dramatiq
from langgraph.graph import END, StateGraph

from app.core import redis
from app.core.db import get_db_async
from app.core.logger import logger
from app.models import AgentRun, AgentRunStatus, Thread
from app.modules.edu_ai.tasks.utils import publish_stream_update


class DemoState(TypedDict):
    """State for demo workflow with streaming."""

    agent_run_id: str
    thread_id: str
    task_name: str
    step_count: int
    result: str
    status: str


async def demo_step_1(state: DemoState) -> DemoState:
    """Step 1: Initialize and analyze"""
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        f"🚀 Initializing task '{state['task_name']}'...",
        data={"step": 1, "action": "initializing"},
    )
    await asyncio.sleep(10)

    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "✅ Initialization complete. Analyzing data patterns...",
        data={"step": 1, "action": "completed", "progress": 25},
        save_db=True,
    )
    await asyncio.sleep(5)

    return {**state, "step_count": state["step_count"] + 1, "status": "analyzing"}


async def demo_step_2(state: DemoState) -> DemoState:
    """Step 2: AI processing"""
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "🤖 Running AI model inference...",
        data={"step": 2, "action": "ai_processing", "model": "gpt-4"},
    )
    await asyncio.sleep(12)

    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "🎯 AI processing complete. Confidence: 94.5%",
        data={"step": 2, "action": "completed", "progress": 50, "confidence": 0.945},
        save_db=True,
    )
    await asyncio.sleep(3)

    return {**state, "step_count": state["step_count"] + 1, "status": "processing"}


async def demo_step_3(state: DemoState) -> DemoState:
    """Step 3: Generate insights"""
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "💡 Generating insights and recommendations...",
        data={"step": 3, "action": "generating_insights"},
    )
    await asyncio.sleep(10)

    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "✨ Generated 5 actionable insights from analysis.",
        data={"step": 3, "action": "completed", "progress": 75, "insights_count": 5},
        save_db=True,
    )
    await asyncio.sleep(3)

    return {**state, "step_count": state["step_count"] + 1, "status": "generating"}


async def demo_step_4(state: DemoState) -> DemoState:
    """Step 4: Compile and complete"""
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "📝 Compiling final results...",
        data={"step": 4, "action": "compiling"},
    )
    await asyncio.sleep(8)

    summary = (
        f"🎉 Task '{state['task_name']}' completed!\n\n"
        f"**Summary:**\n"
        f"- Steps: {state['step_count'] + 1}\n"
        f"- Patterns found: 3\n"
        f"- AI confidence: 94.5%\n"
        f"- Insights: 5\n\n"
        f"✅ All processing complete!"
    )

    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        summary,
        data={
            "step": 4,
            "action": "completed",
            "progress": 100,
            "patterns_found": 3,
            "confidence": 0.945,
            "insights_count": 5,
        },
        save_db=True,
    )

    return {
        **state,
        "step_count": state["step_count"] + 1,
        "result": summary,
        "status": "completed",
    }


def create_demo_graph():
    """Create demo workflow graph with 4 steps (~60 seconds total)"""
    workflow = StateGraph(DemoState)

    workflow.add_node("step_1", demo_step_1)
    workflow.add_node("step_2", demo_step_2)
    workflow.add_node("step_3", demo_step_3)
    workflow.add_node("step_4", demo_step_4)

    workflow.set_entry_point("step_1")
    workflow.add_edge("step_1", "step_2")
    workflow.add_edge("step_2", "step_3")
    workflow.add_edge("step_3", "step_4")
    workflow.add_edge("step_4", END)

    return workflow.compile()


@dramatiq.actor(max_retries=3, time_limit=300_000)  # 5 minute timeout
def demo_educational_task(
    agent_run_id: str,
    thread_id: str,
) -> dict[str, Any]:
    """
    Demo educational AI processing task following agent_runs pattern.

    This task demonstrates:
    1. AgentRun status tracking using proper DB fields
    2. Simple LangGraph workflow execution
    3. Real-time streaming via Redis
    4. Clean error handling and logging

    Args:
        agent_run_id: AgentRun ID for tracking
        thread_id: Thread ID for context

    Returns:
        Dict containing processing results
    """
    logger.info(
        f"[DEMO_TASK] Starting demo task for agent_run {agent_run_id}, thread {thread_id}"
    )

    task_start_time = datetime.now(timezone.utc)

    try:
        # Run async database operations
        return asyncio.run(
            _run_demo_task_async(agent_run_id, thread_id, task_start_time)
        )
    except Exception as e:
        error_msg = f"Error in demo task: {str(e)}"
        logger.error(f"[DEMO_TASK] {error_msg}", exc_info=True)
        return {
            "agent_run_id": agent_run_id,
            "thread_id": thread_id,
            "status": "failed",
            "error": error_msg,
            "started_at": task_start_time.isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }


async def _run_demo_task_async(
    agent_run_id: str,
    thread_id: str,
    task_start_time: datetime,
) -> dict[str, Any]:
    """Async helper function for demo task execution."""
    async with get_db_async() as session:
        # 1. Get the AgentRun record using proper DB field
        agent_run = session.get(AgentRun, uuid.UUID(agent_run_id))

        if not agent_run:
            raise ValueError(f"AgentRun {agent_run_id} not found")

        if agent_run.status != AgentRunStatus.RUNNING:
            raise ValueError(f"AgentRun {agent_run_id} is not in RUNNING state")

        # Get thread for context
        thread = session.get(Thread, uuid.UUID(thread_id))
        if not thread:
            raise ValueError(f"Thread {thread_id} not found")

        task_name = agent_run.my_metadata.get("task_name", "demo_processing")

        # Send initial update
        await publish_stream_update(
            agent_run_id,
            thread_id,
            f"🎬 Starting demo: {task_name}",
            data={"step": 0, "action": "started", "task_name": task_name},
            save_db=True,
        )

        # Create initial state
        initial_state: DemoState = {
            "agent_run_id": agent_run_id,
            "thread_id": thread_id,
            "task_name": task_name,
            "step_count": 0,
            "result": "",
            "status": "starting",
        }

        # Run demo workflow
        try:
            demo_graph = create_demo_graph()
            final_state = await demo_graph.ainvoke(initial_state)
        except Exception as e:
            logger.error(f"[DEMO] Workflow error: {e}")
            await publish_stream_update(
                agent_run_id,
                thread_id,
                f"❌ Error: {str(e)}",
                save_db=True,
            )
            raise

        # Update AgentRun status
        agent_run.status = AgentRunStatus.COMPLETED
        agent_run.completed_at = datetime.now(timezone.utc)
        agent_run.my_metadata.update(
            {
                "result": final_state["result"],
                "steps": final_state["step_count"],
                "duration": (
                    datetime.now(timezone.utc) - task_start_time
                ).total_seconds(),
            }
        )
        session.add(agent_run)
        session.commit()
        session.refresh(agent_run)

        # Cleanup Redis tracking key
        await redis.delete(f"active_run:demo:{agent_run.id}")

        duration = (datetime.now(timezone.utc) - task_start_time).total_seconds()
        logger.info(f"[DEMO_TASK] Completed in {duration:.1f}s")

        return {
            "agent_run_id": str(agent_run.id),
            "status": "completed",
            "duration": duration,
        }


__all__ = ["demo_educational_task"]

