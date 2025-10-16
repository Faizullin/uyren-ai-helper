"""Agent execution background tasks."""

import uuid
from datetime import datetime, timedelta, timezone

import dramatiq
from sqlmodel import select

from app.core import redis
from app.core.db import get_db
from app.core.logger import logger
from app.models import Agent, AgentRun, AgentRunStatus, Thread, ThreadMessage
from app.modules.agents.loader import AgentLoader


@dramatiq.actor(max_retries=3, time_limit=300_000)  # 5 minute timeout
async def execute_agent_run(
    agent_run_id: str,
    thread_id: str,
    model_name: str,
) -> None:
    """
    Execute an agent run in the background.

    This task:
    1. Loads the agent configuration
    2. Retrieves conversation history
    3. Calls LLM with system prompt + messages
    4. Stores assistant response
    5. Updates agent run status

    Args:
        agent_run_id: AgentRun UUID
        thread_id: Thread UUID
        model_name: Model to use for generation
    """
    logger.info(f"[AGENT TASK] Starting execution for run {agent_run_id}")

    async with get_db() as session:
        try:
            # 1. Load agent run
            run_id = uuid.UUID(agent_run_id)
            agent_run = session.get(AgentRun, run_id)

            if not agent_run:
                logger.error(f"Agent run {agent_run_id} not found")
                return

            # Update status to processing
            agent_run.status = AgentRunStatus.PROCESSING
            agent_run.updated_at = datetime.now(timezone.utc)
            session.add(agent_run)
            await session.commit()

            # 2. Load agent configuration
            agent_data = None

            if agent_run.agent_id:
                try:
                    # Load agent (need user context for authorization)
                    # For background tasks, we trust the agent_id was already authorized

                    agent = session.get(Agent, agent_run.agent_id)

                    if agent:
                        temp_loader = AgentLoader()
                        agent_data = temp_loader._agent_to_data(agent)

                        # Load config
                        if agent.current_version_id:
                            await temp_loader._load_agent_config(session, agent_data)

                        logger.debug(f"Loaded agent {agent_data.name}")
                except Exception as e:
                    logger.warning(f"Failed to load agent config: {e}")

            # 3. Get conversation history

            statement = (
                select(ThreadMessage)
                .where(ThreadMessage.thread_id == uuid.UUID(thread_id))
                .order_by(ThreadMessage.created_at.asc())
            )
            messages = session.exec(statement).all()

            # Build conversation
            conversation = []
            if agent_data and agent_data.system_prompt:
                conversation.append(
                    {"role": "system", "content": agent_data.system_prompt}
                )

            for msg in messages:
                conversation.append({"role": msg.role, "content": msg.content})

            logger.debug(
                f"Built conversation with {len(conversation)} messages (system + {len(messages)} user/assistant)"
            )

            # 4. TODO: Call LLM
            # This is where you'd integrate your LLM client
            # For now, mock response
            logger.info(f"[AGENT TASK] TODO: Call LLM with model {model_name}")

            # Mock response (replace with actual LLM call)
            assistant_response = (
                "This is a placeholder response. Implement LLM integration here."
            )

            # Example LLM integration (uncomment when ready):
            # from app.modules.ai_models.manager import model_manager
            # litellm_params = model_manager.get_litellm_params(model_name)
            # response = await litellm.acompletion(
            #     messages=conversation,
            #     **litellm_params
            # )
            # assistant_response = response.choices[0].message.content

            # 5. Store assistant response
            assistant_message = ThreadMessage(
                content=assistant_response,
                role="assistant",
                thread_id=uuid.UUID(thread_id),
            )
            session.add(assistant_message)

            # 6. Update thread timestamp
            thread = session.get(Thread, uuid.UUID(thread_id))
            if thread:
                thread.updated_at = datetime.now(timezone.utc)
                session.add(thread)

            # 7. Mark agent run as completed
            agent_run.status = AgentRunStatus.COMPLETED
            agent_run.completed_at = datetime.now(timezone.utc)
            agent_run.updated_at = datetime.now(timezone.utc)
            session.add(agent_run)

            await session.commit()

            logger.info(f"[AGENT TASK] Completed execution for run {agent_run_id}")

        except Exception as e:
            logger.error(
                f"[AGENT TASK] Error executing agent run {agent_run_id}: {str(e)}",
                exc_info=True,
            )

            # Mark as failed
            if agent_run:
                agent_run.status = AgentRunStatus.FAILED
                agent_run.error_message = str(e)
                agent_run.completed_at = datetime.now(timezone.utc)
                agent_run.updated_at = datetime.now(timezone.utc)
                session.add(agent_run)
                await session.commit()

        finally:
            # Clean up Redis tracking
            try:
                # Remove from active runs
                instance_keys = await redis.keys(f"active_run:*:{agent_run_id}")
                for key in instance_keys:
                    await redis.delete(key)
            except Exception as e:
                logger.warning(f"Failed to clean up Redis keys: {e}")


@dramatiq.actor(max_retries=0)
async def cleanup_stale_agent_runs() -> None:
    """
    Periodic task to clean up stale agent runs.

    Runs every hour to find agent runs stuck in "running" state
    and mark them as failed.
    """
    logger.info("[CLEANUP TASK] Checking for stale agent runs")

    async with get_db() as session:
        # Find runs that have been running for more than 1 hour
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=1)

        statement = select(AgentRun).where(
            AgentRun.status == AgentRunStatus.RUNNING, AgentRun.started_at < cutoff_time
        )

        stale_runs = session.exec(statement).all()

        for run in stale_runs:
            logger.warning(f"Found stale agent run: {run.id}")
            run.status = AgentRunStatus.FAILED
            run.error_message = "Run timed out (exceeded 1 hour)"
            run.completed_at = datetime.now(timezone.utc)
            run.updated_at = datetime.now(timezone.utc)
            session.add(run)

        if stale_runs:
            await session.commit()
            logger.info(f"[CLEANUP TASK] Marked {len(stale_runs)} stale runs as failed")
        else:
            logger.info("[CLEANUP TASK] No stale runs found")


__all__ = [
    "execute_agent_run",
    "cleanup_stale_agent_runs",
]
