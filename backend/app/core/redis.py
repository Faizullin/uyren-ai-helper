"""Redis async client - optimized for agent system."""

import asyncio

import redis.asyncio as redis

from app.core.config import settings
from app.core.logger import logger

# Redis client and connection pool
client: redis.Redis | None = None
pool: redis.ConnectionPool | None = None
_initialized = False
_init_lock = asyncio.Lock()

# Constants
REDIS_KEY_TTL = 3600 * 24  # 24 hour TTL as safety mechanism


def initialize() -> redis.Redis:
    """Initialize Redis connection pool and client."""
    global client, pool

    logger.info(f"Initializing Redis pool: {settings.REDIS_HOST}:{settings.REDIS_PORT}")

    # Create connection pool with production-optimized settings
    pool = redis.ConnectionPool(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None,
        db=settings.REDIS_DB,
        decode_responses=True,
        socket_timeout=15.0,
        socket_connect_timeout=10.0,
        socket_keepalive=True,
        retry_on_timeout=True,
        health_check_interval=30,
        max_connections=128,
    )

    client = redis.Redis(connection_pool=pool)
    return client


async def initialize_async() -> redis.Redis:
    """Initialize Redis connection asynchronously."""
    global client, _initialized

    async with _init_lock:
        if not _initialized:
            initialize()

        try:
            await asyncio.wait_for(client.ping(), timeout=5.0)
            logger.info("Successfully connected to Redis")
            _initialized = True
        except asyncio.TimeoutError:
            logger.error("Redis connection timeout during initialization")
            client = None
            _initialized = False
            raise ConnectionError("Redis connection timeout")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            client = None
            _initialized = False
            raise

    return client


async def close() -> None:
    """Close Redis connection and pool."""
    global client, pool, _initialized

    if client:
        try:
            await asyncio.wait_for(client.aclose(), timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning("Redis close timeout, forcing close")
        except Exception as e:
            logger.warning(f"Error closing Redis client: {e}")
        finally:
            client = None

    if pool:
        try:
            await asyncio.wait_for(pool.aclose(), timeout=5.0)
        except asyncio.TimeoutError:
            logger.warning("Redis pool close timeout, forcing close")
        except Exception as e:
            logger.warning(f"Error closing Redis pool: {e}")
        finally:
            pool = None

    _initialized = False
    logger.info("Redis connection closed")


async def get_client() -> redis.Redis:
    """Get Redis client, initializing if necessary."""
    global client, _initialized
    if client is None or not _initialized:
        await initialize_async()
    return client


# ==================== Core Operations (What You Actually Need) ====================


async def set(key: str, value: str, ex: int | None = None, nx: bool = False) -> bool:
    """
    Set a key-value pair.

    Args:
        key: Redis key
        value: Value to store
        ex: Expiration in seconds
        nx: Only set if key doesn't exist (NX = "not exists")

    Example:
        await redis.set("active_run:instance1:run123", "running", ex=REDIS_KEY_TTL)
    """
    redis_client = await get_client()
    return await redis_client.set(key, value, ex=ex, nx=nx)


async def get(key: str, default: str | None = None) -> str | None:
    """
    Get a value by key.

    Example:
        status = await redis.get("active_run:instance1:run123")
    """
    redis_client = await get_client()
    result = await redis_client.get(key)
    return result if result is not None else default


async def delete(key: str) -> int:
    """
    Delete a key.

    Returns:
        Number of keys deleted (0 or 1)
    """
    redis_client = await get_client()
    return await redis_client.delete(key)


async def exists(key: str) -> bool:
    """Check if a key exists."""
    redis_client = await get_client()
    return bool(await redis_client.exists(key))


async def expire(key: str, seconds: int) -> bool:
    """Set expiration time on a key."""
    redis_client = await get_client()
    return await redis_client.expire(key, seconds)


async def keys(pattern: str) -> list[str]:
    """
    Get all keys matching a pattern.

    Example:
        active_runs = await redis.keys("active_run:*")

    WARNING: Use sparingly in production (scans all keys)
    """
    redis_client = await get_client()
    return await redis_client.keys(pattern)


# ==================== Pub/Sub (For Real-Time Updates) ====================


async def publish(channel: str, message: str) -> int:
    """
    Publish message to a channel (for real-time notifications).

    Example:
        # Notify frontend that agent completed
        await redis.publish("agent_updates", json.dumps({
            "agent_run_id": "123",
            "status": "completed"
        }))

    Returns:
        Number of subscribers that received the message
    """
    redis_client = await get_client()
    return await redis_client.publish(channel, message)


async def subscribe(channel: str):
    """
    Subscribe to a channel for real-time updates.

    Example:
        pubsub = await redis.subscribe("agent_updates")
        async for message in pubsub.listen():
            if message["type"] == "message":
                print(message["data"])
    """
    redis_client = await get_client()
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(channel)
    return pubsub


# ==================== Advanced Operations (Use If Needed) ====================


async def incr(key: str) -> int:
    """
    Increment a counter.

    Example:
        # Track number of active runs for rate limiting
        count = await redis.incr("user:123:active_runs")
    """
    redis_client = await get_client()
    return await redis_client.incr(key)


async def decr(key: str) -> int:
    """Decrement a counter."""
    redis_client = await get_client()
    return await redis_client.decr(key)


async def setex(key: str, seconds: int, value: str) -> bool:
    """Set key with expiration (shorthand for set with ex)."""
    redis_client = await get_client()
    return await redis_client.setex(key, seconds, value)


async def ttl(key: str) -> int:
    """
    Get time-to-live for a key in seconds.

    Returns:
        -2 if key doesn't exist
        -1 if key has no expiration
        Positive number = seconds remaining
    """
    redis_client = await get_client()
    return await redis_client.ttl(key)


__all__ = [
    "REDIS_KEY_TTL",
    "initialize_async",
    "close",
    "get_client",
    # Core operations (essential)
    "set",
    "get",
    "delete",
    "exists",
    "expire",
    "keys",
    # Pub/Sub (for real-time)
    "publish",
    "subscribe",
    # Advanced (optional)
    "incr",
    "decr",
    "setex",
    "ttl",
]
