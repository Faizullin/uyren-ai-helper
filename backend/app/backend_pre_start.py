import asyncio
import logging

from sqlalchemy import Engine
from sqlmodel import Session, select
from tenacity import after_log, before_log, retry, stop_after_attempt, wait_fixed

from app.core.db import engine
from app.core.redis import initialize_async

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

max_tries = 60 * 5  # 5 minutes
wait_seconds = 1


@retry(
    stop=stop_after_attempt(max_tries),
    wait=wait_fixed(wait_seconds),
    before=before_log(logger, logging.INFO),
    after=after_log(logger, logging.WARN),
)
def init(db_engine: Engine) -> None:
    try:
        with Session(db_engine) as session:
            # Try to create session to check if DB is awake
            session.exec(select(1))
    except Exception as e:
        logger.error(e)
        raise e


@retry(
    stop=stop_after_attempt(max_tries),
    wait=wait_fixed(wait_seconds),
    before=before_log(logger, logging.INFO),
    after=after_log(logger, logging.WARN),
)
async def init_redis() -> None:
    """Initialize and health check Redis connection."""
    try:
        logger.info("Checking Redis connection...")
        await initialize_async()
        logger.info("Redis connection successful")
    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        raise e


async def main() -> None:
    logger.info("Initializing service")

    # Initialize database
    logger.info("Checking database connection...")
    init(engine)
    logger.info("Database connection successful")

    # Initialize Redis
    logger.info("Checking Redis connection...")
    await init_redis()
    logger.info("Redis connection successful")

    logger.info("Service finished initializing")


if __name__ == "__main__":
    asyncio.run(main())
