"""
Shared utilities for Educational AI tasks.

This module contains helper functions used across different tasks.
"""

import json
import uuid
from datetime import datetime, timezone

from app.core import redis
from app.core.db import get_db_async
from app.core.logger import logger
from app.models import ThreadMessage


async def publish_stream_update(
    agent_run_id: str,
    thread_id: str,
    content: str,
    data: dict | None = None,
    save_db: bool = False,
):
    """
    Publish streaming update to Redis (and optionally save to DB for history).

    This is the standard way to send real-time updates from background tasks
    to the SSE streaming endpoint.

    Args:
        agent_run_id: Agent run ID for Redis streaming
        thread_id: Thread ID for database message
        content: Human-readable update content
        data: Optional structured data for frontend
        save_db: Save to database for permanent history (default: False)

    Example:
        await publish_stream_update(
            agent_run_id="123",
            thread_id="456",
            content="Processing step 1 of 4...",
            data={"step": 1, "progress": 25},
            save_db=True,
        )
    """
    # Redis streaming data structure
    stream_data = {
        "type": "message",
        "content": content,
        "data": data,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    # Always publish to Redis for streaming
    try:
        redis_client = await redis.get_client()
        
        # Store data in list (persistent until cleanup)
        await redis_client.rpush(
            f"agent_run:{agent_run_id}:responses",
            json.dumps(stream_data),
        )
        
        # Publish notification to Pub/Sub (transient)
        await redis_client.publish(
            f"agent_run:{agent_run_id}:new_response",
            "new",  # Simple notification, actual data is in list
        )
        
        logger.debug(f"Published stream update for agent_run {agent_run_id}")
    except Exception as e:
        logger.warning(f"Redis publish failed for agent_run {agent_run_id}: {e}")

    # Optionally save to DB for permanent history
    if save_db:
        try:
            async with get_db_async() as session:
                session.add(
                    ThreadMessage(
                        thread_id=uuid.UUID(thread_id),
                        role="assistant",
                        content=content,
                        data=data,
                        created_at=datetime.now(timezone.utc),
                    )
                )
                session.commit()
                logger.debug(f"Saved message to DB for thread {thread_id}")
        except Exception as e:
            logger.warning(f"DB save failed for thread {thread_id}: {e}")


__all__ = ["publish_stream_update"]

