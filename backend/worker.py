"""Dramatiq worker entry point."""

from app.tasks.broker import redis_broker  # noqa: F401
from app.tasks import agent_tasks  # noqa: F401

# Import all task modules here so Dramatiq can discover them
# The broker must be imported first

if __name__ == "__main__":
    print("Starting Dramatiq worker...")
    print("Tasks registered:")
    print("  - execute_agent_run")
    print("  - cleanup_stale_agent_runs")

