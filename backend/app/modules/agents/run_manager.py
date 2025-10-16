"""Agent run management utilities - starting, stopping, and monitoring."""

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlmodel import Session, select

from app.core import redis
from app.core.logger import logger
from app.models import AgentRun, AgentRunStatus, Thread


async def stop_agent_run_with_helpers(
    session: Session,
    agent_run_id: uuid.UUID,
    error_message: str | None = None,
) -> bool:
    """
    Stop an agent run and clean up all associated resources.

    This function:
    1. Updates database status to stopped/failed
    2. Publishes STOP signals to control channels
    3. Cleans up Redis keys

    Args:
        session: Database session
        agent_run_id: The ID of the agent run to stop
        error_message: Optional error message if run failed

    Returns:
        True if stopped successfully

    Raises:
        HTTPException: If agent run not found or update fails
    """
    logger.debug(f"Stopping agent run with helpers: {agent_run_id}")

    agent_run = session.get(AgentRun, agent_run_id)
    if not agent_run:
        raise HTTPException(status_code=404, detail="Agent run not found")

    final_status = AgentRunStatus.FAILED if error_message else AgentRunStatus.CANCELLED

    # Update database status
    agent_run.status = final_status
    agent_run.completed_at = datetime.now(timezone.utc)
    agent_run.updated_at = datetime.now(timezone.utc)

    if error_message:
        agent_run.error_message = error_message

    session.add(agent_run)
    session.commit()

    logger.info(f"Updated agent run {agent_run_id} to status: {final_status}")

    # Send STOP signal to global control channel
    global_control_channel = f"agent_run:{agent_run_id}:control"
    try:
        await redis.publish(global_control_channel, "STOP")
        logger.debug(f"Published STOP signal to {global_control_channel}")
    except Exception as e:
        logger.error(f"Failed to publish STOP signal: {e}")

    # Find all instances handling this run and clean up
    try:
        instance_keys = await redis.keys(f"active_run:*:{agent_run_id}")
        logger.debug(f"Found {len(instance_keys)} active instance keys")

        for key in instance_keys:
            # Key format: active_run:{instance_id}:{agent_run_id}
            parts = key.split(":")
            if len(parts) == 3:
                instance_id = parts[1]
                instance_control_channel = (
                    f"agent_run:{agent_run_id}:control:{instance_id}"
                )
                try:
                    await redis.publish(instance_control_channel, "STOP")
                    logger.debug(
                        f"Published STOP to instance channel {instance_control_channel}"
                    )
                except Exception as e:
                    logger.warning(f"Failed to publish to instance channel: {e}")

                # Delete the active run key
                try:
                    await redis.delete(key)
                except Exception as e:
                    logger.warning(f"Failed to delete Redis key {key}: {e}")

        # Clean up response list
        response_list_key = f"agent_run:{agent_run_id}:responses"
        try:
            await redis.delete(response_list_key)
            logger.debug(f"Cleaned up response list: {response_list_key}")
        except Exception as e:
            logger.warning(f"Failed to cleanup response list: {e}")

    except Exception as e:
        logger.error(f"Failed to cleanup Redis for {agent_run_id}: {e}")

    logger.debug(f"Successfully stopped agent run: {agent_run_id}")
    return True


async def cleanup_instance_runs(
    session: Session,
    instance_id: str,
) -> None:
    """
    Clean up all running agents for a specific instance.

    Used during instance shutdown to gracefully stop all agent runs.

    Args:
        session: Database session
        instance_id: Instance ID to clean up
    """
    logger.debug(f"Starting cleanup of agent runs for instance {instance_id}")

    try:
        if not instance_id:
            logger.warning("Instance ID not set, cannot clean up")
            return

        # Find all active runs for this instance
        running_keys = await redis.keys(f"active_run:{instance_id}:*")
        logger.debug(
            f"Found {len(running_keys)} running agent runs for instance {instance_id}"
        )

        for key in running_keys:
            # Key format: active_run:{instance_id}:{agent_run_id}
            parts = key.split(":")
            if len(parts) == 3:
                agent_run_id = uuid.UUID(parts[2])
                await stop_agent_run_with_helpers(
                    session=session,
                    agent_run_id=agent_run_id,
                    error_message=f"Instance {instance_id} shutting down",
                )
            else:
                logger.warning(f"Unexpected key format: {key}")

        logger.info(
            f"Cleaned up {len(running_keys)} agent runs for instance {instance_id}"
        )

    except Exception as e:
        logger.error(f"Failed to cleanup instance runs for {instance_id}: {e}")


async def check_for_active_project_agent_run(
    session: Session,
    project_id: uuid.UUID,
) -> uuid.UUID | None:
    """
    Check if there are any active agent runs for a project.

    Args:
        session: Database session
        project_id: The project ID to check

    Returns:
        The ID of an active agent run, or None if no active runs
    """
    try:
        # Get all threads for this project
        statement = select(Thread.id).where(Thread.project_id == project_id)
        project_threads = session.exec(statement).all()

        if not project_threads:
            return None

        # Check for active agent runs in these threads
        active_run_stmt = (
            select(AgentRun.id)
            .where(
                AgentRun.thread_id.in_(project_threads),
                AgentRun.status == AgentRunStatus.RUNNING,
            )
            .limit(1)
        )

        active_run = session.exec(active_run_stmt).first()

        if active_run:
            logger.debug(
                f"Found active agent run {active_run} for project {project_id}"
            )
            return active_run

        return None

    except Exception as e:
        logger.error(f"Error checking for active runs in project {project_id}: {e}")
        return None


__all__ = [
    "stop_agent_run_with_helpers",
    "cleanup_instance_runs",
    "check_for_active_project_agent_run",
]
