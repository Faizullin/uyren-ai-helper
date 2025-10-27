"""Dramatiq broker configuration."""

import dramatiq
from dramatiq.brokers.redis import RedisBroker

from app.core.config import settings
from app.core.logger import logger

# Initialize Redis broker for Dramatiq
redis_broker = RedisBroker(url=settings.REDIS_URL)
dramatiq.set_broker(redis_broker)

logger.info(
    f"Dramatiq broker initialized with Redis: {settings.REDIS_HOST}:{settings.REDIS_PORT}"
)

from app.modules.edu_ai import tasks as edu_ai_tasks

__all__ = [
    "redis_broker",
    "edu_ai_tasks",
]
