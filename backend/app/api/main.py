from fastapi import APIRouter

from app.routers import (
    agent_runs_router,
    agents_router,
    grading_router,
    threads_router,
    users_router,
)

api_router = APIRouter()
api_router.include_router(users_router)
api_router.include_router(threads_router)
api_router.include_router(agents_router)
api_router.include_router(agent_runs_router)
api_router.include_router(grading_router)
