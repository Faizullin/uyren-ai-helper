"""
Vector Store Router
Combines all vector store module routes into a single router
"""

from fastapi import APIRouter

from app.modules.vector_store.router import router

# Create main vector store router
vector_store_router = APIRouter(tags=["vector-store"])
vector_store_router.include_router(router)

__all__ = ["vector_store_router"]
