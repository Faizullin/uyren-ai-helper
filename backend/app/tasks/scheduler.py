"""Task scheduler for periodic background jobs."""

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.core.logger import logger
from app.tasks.agent_tasks import cleanup_stale_agent_runs

# Global scheduler instance
scheduler: AsyncIOScheduler | None = None


def start_scheduler() -> None:
    """Start the background task scheduler."""
    global scheduler

    if scheduler is not None:
        logger.warning("Scheduler already started")
        return

    scheduler = AsyncIOScheduler()

    # Schedule cleanup task (runs every hour)
    scheduler.add_job(
        cleanup_stale_agent_runs.send,
        trigger=CronTrigger(minute=0),  # Every hour at minute 0
        id="cleanup_stale_runs",
        name="Cleanup Stale Agent Runs",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("Task scheduler started with periodic jobs")


def stop_scheduler() -> None:
    """Stop the background task scheduler."""
    global scheduler

    if scheduler:
        scheduler.shutdown(wait=False)
        scheduler = None
        logger.info("Task scheduler stopped")


__all__ = ["start_scheduler", "stop_scheduler"]

