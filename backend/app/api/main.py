from fastapi import APIRouter

from app.modules.edu_ai.router import edu_ai_router
from app.routers.agent_runs import router as agent_runs_router
from app.routers.agents import router as agents_router
from app.routers.api_keys import router as api_keys_router
from app.routers.billing import router as billing_router
from app.routers.knowledge_base import router as knowledge_base_router
from app.routers.projects import router as projects_router
from app.routers.threads import router as threads_router
from app.routers.users import router as users_router
from app.routers.vector_store import vector_store_router

api_router = APIRouter()
api_router.include_router(users_router)
api_router.include_router(projects_router)
api_router.include_router(threads_router)
api_router.include_router(agents_router)
api_router.include_router(agent_runs_router)
api_router.include_router(api_keys_router)
api_router.include_router(vector_store_router)
api_router.include_router(knowledge_base_router)
api_router.include_router(billing_router)
api_router.include_router(edu_ai_router)
