"""
Educational AI Tasks Module

This module contains all background tasks for the Educational AI system.
Tasks are organized by functionality for better maintainability.
"""

from app.modules.edu_ai.tasks.autograder_task import autograder_task
from app.modules.edu_ai.tasks.demo_task import demo_educational_task
from app.modules.edu_ai.tasks.rag_chatbot_task import rag_chatbot_task
from app.modules.edu_ai.tasks.utils import publish_stream_update

__all__ = [
    "demo_educational_task",
    "autograder_task",
    "rag_chatbot_task",
    "publish_stream_update",
]

