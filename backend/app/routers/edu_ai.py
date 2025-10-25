"""
Educational AI Router
Combines all edu_ai module routes into a single router
"""

from fastapi import APIRouter

from app.modules.edu_ai.routers.demo_tasks import router as demo_tasks_router
from app.modules.edu_ai.routers.threads import router as threads_router

# Create main edu_ai router
edu_ai_router = APIRouter(tags=["edu-ai"])

# Include all sub-routers
edu_ai_router.include_router(demo_tasks_router)
edu_ai_router.include_router(threads_router)

__all__ = ["edu_ai_router"]
