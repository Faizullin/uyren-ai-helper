"""Dramatiq broker configuration."""

import dramatiq
from dramatiq.brokers.redis import RedisBroker

from app.core.config import settings
from app.core.logger import logger

# Initialize Redis broker for Dramatiq
redis_broker = RedisBroker(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None,
    db=settings.REDIS_DB,
)

# Set as global broker
dramatiq.set_broker(redis_broker)

logger.info(f"Dramatiq broker initialized with Redis: {settings.REDIS_HOST}:{settings.REDIS_PORT}")

__all__ = ["redis_broker"]

