"""Educational AI routers package."""

from fastapi import APIRouter

from .autograder import router as autograder_router
from .demo_tasks import router as demo_tasks_router
from .rag_chatbot import router as rag_chatbot_router
from .rag_query import router as rag_query_router
from .threads import router as threads_router

edu_ai_router = APIRouter(tags=["edu_ai"])
edu_ai_router.include_router(autograder_router)
edu_ai_router.include_router(demo_tasks_router)
edu_ai_router.include_router(rag_chatbot_router)
edu_ai_router.include_router(threads_router)
edu_ai_router.include_router(rag_query_router)

__all__ = [
    "edu_ai_router",
]
