"""Educational AI routers package."""

from .demo_tasks import router as demo_tasks_router
from .threads import router as threads_router

__all__ = [
    "demo_tasks_router",
    "threads_router",
]