"""
RAG Chatbot Task for LMS Resources

Creates embeddings from LMS resources (courses/lessons) and stores in vector store
for intelligent retrieval and chatbot interactions.

Workflow:
- Fetch LMS resource (course/lesson)
- Process and chunk content
- Generate embeddings
- Store in vector store
- Enable RAG-based chatbot queries
"""

import asyncio
import operator
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any, TypedDict

import dramatiq
from langchain_core.documents import Document
from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from langgraph.graph import END, StateGraph

from langchain_openai import OpenAIEmbeddings
from sqlmodel import select

from app.core import redis
from app.core.db import get_db_async
from app.core.logger import logger
from app.models import AgentRun, AgentRunStatus, Project, Thread
from app.models.api_key import APIKey
from app.modules.edu_ai.models import LMSResource
from app.modules.edu_ai.tasks.utils import publish_stream_update
from app.modules.vector_store.manager import vector_store_manager
from app.modules.vector_store.models import Page, PageSection, VectorStore
from app.modules.vector_store.rag import document_processor


class RAGChatbotState(TypedDict):
    """
    State for RAG chatbot workflow.

    Follows graph.py pattern with message accumulation.
    """

    # Input IDs
    agent_run_id: str
    thread_id: str
    lms_resource_id: str
    vector_store_id: str | None

    # Configuration
    create_vector_store: bool
    project_id: str | None
    api_key_id: str | None
    openai_api_key: str | None

    # Loaded data
    lms_resource: dict
    content_data: dict
    project_info: dict

    # Processing results
    chunks: list[Document]
    page_id: str | None
    section_ids: list[str]
    embeddings_count: int

    # Final output
    vector_store_info: dict

    # Workflow control (LangChain pattern)
    messages: Annotated[list[BaseMessage], operator.add]
    error: str | None
    retry_count: int


async def fetch_lms_resource(state: RAGChatbotState) -> RAGChatbotState:
    """
    NODE 1: Fetch LMS resource and project API key

    This node:
    1. Loads LMS resource from database
    2. Loads project and extracts API key
    3. Validates API key access
    4. Extracts content for processing
    5. Stores data in state
    """
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "📚 Fetching LMS resource and project configuration...",
        data={"step": 1, "action": "fetching_resource"},
    )

    async with get_db_async() as session:
        # Load LMS resource
        lms_resource = session.get(LMSResource, uuid.UUID(state["lms_resource_id"]))

        if not lms_resource:
            error_msg = f"LMS resource {state['lms_resource_id']} not found"
            await publish_stream_update(
                state["agent_run_id"],
                state["thread_id"],
                f"❌ Error: {error_msg}",
                save_db=True,
            )
            return {**state, "error": error_msg}

        # Load project and get API key
        project_info = {}
        api_key_id = None
        openai_api_key = None

        if state.get("project_id"):
            project = session.get(Project, uuid.UUID(state["project_id"]))
            if project:
                project_info = {
                    "id": str(project.id),
                    "name": project.name,
                    "owner_id": str(project.owner_id),
                }

                # Get API key from project metadata or first active API key for project
                api_key_from_meta = project.my_metadata.get("openai_api_key_id")

                if api_key_from_meta:
                    api_key_obj = session.get(APIKey, uuid.UUID(api_key_from_meta))
                else:
                    # Find first active API key for this project
                    api_key_statement = select(APIKey).where(
                        APIKey.project_id == project.id,
                        APIKey.status == "active",
                    ).limit(1)
                    api_key_obj = session.exec(api_key_statement).first()

                if api_key_obj:
                    api_key_id = str(api_key_obj.id)
                    # Use public_key as the OpenAI API key
                    openai_api_key = api_key_obj.public_key

                    await publish_stream_update(
                        state["agent_run_id"],
                        state["thread_id"],
                        f"🔑 Using project API key: {api_key_obj.title}",
                        data={"api_key_title": api_key_obj.title},
                    )
                else:
                    await publish_stream_update(
                        state["agent_run_id"],
                        state["thread_id"],
                        "⚠️ No API key found in project, using default",
                        data={"using_default": True},
                    )

        content_data = {
            "title": lms_resource.title,
            "description": lms_resource.description,
            "content": lms_resource.content,
            "target_type": lms_resource.target_type,
            "target_id": str(lms_resource.target_id) if lms_resource.target_id else None,
        }

        await publish_stream_update(
            state["agent_run_id"],
            state["thread_id"],
            f"✅ Loaded '{lms_resource.title}' ({lms_resource.target_type or 'resource'})",
            data={
                "step": 1,
                "action": "resource_loaded",
                "progress": 20,
                "title": lms_resource.title,
                "type": lms_resource.target_type,
            },
            save_db=True,
        )

        return {
            **state,
            "lms_resource": {
                "id": str(lms_resource.id),
                "title": lms_resource.title,
                "description": lms_resource.description,
                "target_type": lms_resource.target_type,
                "owner_id": str(lms_resource.owner_id),
            },
            "content_data": content_data,
            "project_info": project_info,
            "api_key_id": api_key_id,
            "openai_api_key": openai_api_key,
            "messages": [
                SystemMessage(
                    content=f"Loaded LMS resource: {lms_resource.title} (type: {lms_resource.target_type}), "
                    f"using {'project API key' if openai_api_key else 'default API key'}"
                )
            ],
        }


async def process_and_chunk_content(state: RAGChatbotState) -> RAGChatbotState:
    """
    NODE 2: Process content and create chunks

    This node:
    1. Combines title, description, and content
    2. Uses LangChain text splitter to create chunks
    3. Creates Document objects for embedding
    """
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "✂️ Processing and chunking content...",
        data={"step": 2, "action": "chunking_content"},
    )

    content_data = state["content_data"]
    combined_content = f"""# {content_data['title']}

{content_data.get('description', '')}

{content_data.get('content', '')}
"""

    # Use LangChain text splitter
    chunks = document_processor.text_splitter.split_text(combined_content)

    # Create Document objects with metadata
    documents = [
        Document(
            page_content=chunk,
            metadata={
                "lms_resource_id": state["lms_resource_id"],
                "title": content_data["title"],
                "target_type": content_data.get("target_type"),
                "chunk_index": idx,
                "total_chunks": len(chunks),
            },
        )
        for idx, chunk in enumerate(chunks)
    ]

    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        f"✅ Created {len(documents)} content chunks",
        data={
            "step": 2,
            "action": "chunking_complete",
            "progress": 40,
            "chunk_count": len(documents),
        },
        save_db=True,
    )

    return {
        **state,
        "chunks": documents,
        "messages": [
            AIMessage(content=f"Processed content into {len(documents)} chunks")
        ],
    }


async def generate_and_store_embeddings(state: RAGChatbotState) -> RAGChatbotState:
    """
    NODE 3: Generate embeddings and store in vector store

    This node:
    1. Creates or uses existing vector store
    2. Generates embeddings for all chunks
    3. Stores as Page and PageSections
    4. Updates vector store metadata
    """
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "🧠 Generating embeddings...",
        data={"step": 3, "action": "generating_embeddings"},
    )

    async with get_db_async() as session:
        # Get or create vector store
        vector_store_id = state.get("vector_store_id")
        lms_resource = state["lms_resource"]

        if not vector_store_id and state.get("create_vector_store"):
            # Create new vector store
            vector_store = vector_store_manager.create_vector_store(
                session=session,
                owner_id=uuid.UUID(lms_resource["owner_id"]),
                name=f"RAG Store: {lms_resource['title']}",
                project_id=uuid.UUID(state["project_id"]) if state.get("project_id") else None,
                description=f"Vector store for {lms_resource['target_type']}: {lms_resource['title']}",
            )
            vector_store_id = str(vector_store.id)

            await publish_stream_update(
                state["agent_run_id"],
                state["thread_id"],
                f"📦 Created new vector store: {vector_store.name}",
                data={"vector_store_id": vector_store_id},
            )
        else:
            # Use existing vector store
            vector_store = session.get(VectorStore, uuid.UUID(vector_store_id))
            if not vector_store:
                error_msg = f"Vector store {vector_store_id} not found"
                return {**state, "error": error_msg}

        # Create Page for this LMS resource
        page = Page(
            vector_store_id=vector_store.id,
            source_url=f"lms://resource/{state['lms_resource_id']}",
            title=lms_resource["title"],
            metadata={
                "lms_resource_id": state["lms_resource_id"],
                "target_type": lms_resource.get("target_type"),
                "source": "lms_resource",
            },
        )
        session.add(page)
        session.flush()

        # Create PageSections and generate embeddings
        section_ids = []
        chunks = state.get("chunks", [])

        for idx, doc in enumerate(chunks):
            section = PageSection(
                page_id=page.id,
                heading=f"Section {idx + 1}",
                content=doc.page_content,
                metadata=doc.metadata,
                chunk_index=idx,
            )
            session.add(section)
            section_ids.append(section.id)

        session.flush()

        await publish_stream_update(
            state["agent_run_id"],
            state["thread_id"],
            f"⚡ Embedding {len(section_ids)} sections...",
            data={"section_count": len(section_ids)},
        )

        # Create embeddings service with project API key or default
        if state.get("openai_api_key"):
            # Use project's OpenAI API key
            embeddings_client = OpenAIEmbeddings(
                model="text-embedding-3-small",
                openai_api_key=state["openai_api_key"],
            )
            logger.info("[RAG_CHATBOT] Using project-specific OpenAI API key for embeddings")
        else:
            # Use default embedding service
            from app.modules.vector_store.rag import (
                embedding_service as default_service,
            )

            embeddings_client = default_service.embeddings
            logger.info("[RAG_CHATBOT] Using default OpenAI API key for embeddings")

        # Generate embeddings in batch
        sections_to_embed = session.exec(
            select(PageSection).where(PageSection.id.in_(section_ids))
        ).all()

        texts_to_embed = [section.content for section in sections_to_embed]

        if embeddings_client:
            # Generate embeddings using LangChain
            embeddings_vectors = await embeddings_client.aembed_documents(texts_to_embed)

            # Store embeddings in database
            embedded_count = 0
            for section, embedding_vector in zip(sections_to_embed, embeddings_vectors, strict=True):
                section.embedding = embedding_vector
                session.add(section)
                embedded_count += 1
        else:
            raise ValueError("No embeddings client available (OpenAI API key missing)")

        session.commit()

        await publish_stream_update(
            state["agent_run_id"],
            state["thread_id"],
            f"✅ Generated and stored {embedded_count} embeddings",
            data={
                "step": 3,
                "action": "embeddings_complete",
                "progress": 80,
                "embeddings_count": embedded_count,
            },
            save_db=True,
        )

        return {
            **state,
            "page_id": str(page.id),
            "section_ids": [str(sid) for sid in section_ids],
            "embeddings_count": embedded_count,
            "vector_store_id": vector_store_id,
            "messages": [
                AIMessage(
                    content=f"Stored {embedded_count} embeddings in vector store"
                )
            ],
        }


async def save_rag_results(state: RAGChatbotState) -> RAGChatbotState:
    """
    NODE 4: Save RAG processing results

    This node:
    1. Updates LMS resource with vector store reference
    2. Stores processing metadata
    3. Marks as RAG-enabled
    """
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "💾 Saving RAG configuration...",
        data={"step": 4, "action": "saving_results"},
    )

    async with get_db_async() as session:
        lms_resource = session.get(LMSResource, uuid.UUID(state["lms_resource_id"]))

        if lms_resource:
            # Update metadata with RAG information
            current_metadata = lms_resource.my_metadata or {}
            current_metadata["rag_config"] = {
                "vector_store_id": state.get("vector_store_id"),
                "page_id": state.get("page_id"),
                "embeddings_count": state.get("embeddings_count", 0),
                "processed_at": datetime.now(timezone.utc).isoformat(),
                "model": "text-embedding-3-small",
                "dimension": 1536,
                "api_key_id": state.get("api_key_id"),
                "used_project_api_key": bool(state.get("openai_api_key")),
            }
            lms_resource.my_metadata = current_metadata
            lms_resource.updated_at = datetime.now(timezone.utc)

            session.add(lms_resource)
            session.commit()

    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "✅ RAG chatbot ready! Vector store configured successfully.",
        data={
            "step": 4,
            "action": "completed",
            "progress": 100,
            "vector_store_id": state.get("vector_store_id"),
            "embeddings_count": state.get("embeddings_count", 0),
        },
        save_db=True,
    )

    return {
        **state,
        "vector_store_info": {
            "vector_store_id": state.get("vector_store_id"),
            "page_id": state.get("page_id"),
            "embeddings_count": state.get("embeddings_count", 0),
        },
        "messages": [SystemMessage(content="RAG results saved to database")],
    }


def create_rag_chatbot_graph():
    """
    Build the LangGraph RAG chatbot workflow

    Flow:
    START → fetch_lms_resource → process_and_chunk_content
          → generate_and_store_embeddings → save_rag_results → END

    Follows the same pattern as educational_ai_graph in graph.py
    """
    workflow = StateGraph(RAGChatbotState)

    # Add all nodes
    workflow.add_node("fetch", fetch_lms_resource)
    workflow.add_node("chunk", process_and_chunk_content)
    workflow.add_node("embed", generate_and_store_embeddings)
    workflow.add_node("save", save_rag_results)

    # Define edges (flow)
    workflow.set_entry_point("fetch")
    workflow.add_edge("fetch", "chunk")
    workflow.add_edge("chunk", "embed")
    workflow.add_edge("embed", "save")
    workflow.add_edge("save", END)

    # Compile workflow
    return workflow.compile()


@dramatiq.actor(max_retries=3, time_limit=600_000)  # 10 minute timeout
def rag_chatbot_task(
    agent_run_id: str,
    thread_id: str,
    lms_resource_id: str,
    vector_store_id: str | None = None,
    create_vector_store: bool = False,
    project_id: str | None = None,
) -> dict[str, Any]:
    """
    RAG chatbot setup task for LMS resources.

    This task:
    1. Fetches LMS resource (course/lesson)
    2. Processes and chunks content using LangChain
    3. Generates embeddings
    4. Stores in vector store for RAG queries

    Args:
        agent_run_id: AgentRun ID for tracking
        thread_id: Thread ID for context
        lms_resource_id: LMS Resource to process
        vector_store_id: Existing vector store ID (optional)
        create_vector_store: Create new vector store if None provided
        project_id: Project ID for organization

    Returns:
        Dict containing processing results
    """
    logger.info(
        "[RAG_CHATBOT] Starting RAG setup for LMS resource %s, agent_run %s",
        lms_resource_id,
        agent_run_id,
    )

    task_start_time = datetime.now(timezone.utc)

    try:
        return asyncio.run(
            _run_rag_chatbot_async(
                agent_run_id,
                thread_id,
                lms_resource_id,
                vector_store_id,
                create_vector_store,
                project_id,
                task_start_time,
            )
        )
    except Exception as e:
        error_msg = f"RAG chatbot error: {str(e)}"
        logger.error(f"[RAG_CHATBOT] {error_msg}", exc_info=True)
        return {
            "agent_run_id": agent_run_id,
            "thread_id": thread_id,
            "status": "failed",
            "error": error_msg,
            "started_at": task_start_time.isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }


async def _run_rag_chatbot_async(
    agent_run_id: str,
    thread_id: str,
    lms_resource_id: str,
    vector_store_id: str | None,
    create_vector_store: bool,
    project_id: str | None,
    task_start_time: datetime,
) -> dict[str, Any]:
    """Async helper for RAG chatbot execution."""
    async with get_db_async() as session:
        # Get the AgentRun record
        agent_run = session.get(AgentRun, uuid.UUID(agent_run_id))
        if not agent_run:
            raise ValueError(f"AgentRun {agent_run_id} not found")

        if agent_run.status != AgentRunStatus.RUNNING:
            raise ValueError(f"AgentRun {agent_run_id} is not in RUNNING state")

        # Get thread
        thread = session.get(Thread, uuid.UUID(thread_id))
        if not thread:
            raise ValueError(f"Thread {thread_id} not found")

        # Send initial update
        await publish_stream_update(
            agent_run_id,
            thread_id,
            "🤖 Starting RAG chatbot setup...",
            data={
                "step": 0,
                "action": "started",
                "lms_resource_id": lms_resource_id,
            },
            save_db=True,
        )

        # Create initial state (following graph.py pattern with LangChain messages)
        initial_state: RAGChatbotState = {
            # Input IDs
            "agent_run_id": agent_run_id,
            "thread_id": thread_id,
            "lms_resource_id": lms_resource_id,
            "vector_store_id": vector_store_id,
            # Configuration
            "create_vector_store": create_vector_store,
            "project_id": project_id,
            # Loaded data
            "lms_resource": {},
            "content_data": {},
            "project_info": {},
            "api_key_id": None,
            "openai_api_key": None,
            # Processing results
            "chunks": [],
            "page_id": None,
            "section_ids": [],
            "embeddings_count": 0,
            # Final output
            "vector_store_info": {},
            # Workflow control (LangChain pattern)
            "messages": [],
            "error": None,
            "retry_count": 0,
        }

        # Run RAG chatbot workflow
        try:
            rag_graph = create_rag_chatbot_graph()
            final_state = await rag_graph.ainvoke(initial_state)
        except Exception as e:
            logger.error(f"[RAG_CHATBOT] Workflow error: {e}")
            await publish_stream_update(
                agent_run_id,
                thread_id,
                f"❌ Error: {str(e)}",
                save_db=True,
            )
            raise

        # Check for errors in final state
        if final_state.get("error"):
            raise ValueError(final_state["error"])

        # Update AgentRun status with comprehensive results
        agent_run.status = AgentRunStatus.COMPLETED
        agent_run.completed_at = datetime.now(timezone.utc)

        # Store RAG setup results in metadata
        agent_run.my_metadata.update(
            {
                "lms_resource_id": lms_resource_id,
                "rag_results": {
                    "vector_store_id": final_state.get("vector_store_id"),
                    "page_id": final_state.get("page_id"),
                    "embeddings_count": final_state.get("embeddings_count", 0),
                    "chunk_count": len(final_state.get("chunks", [])),
                    "vector_store_info": final_state.get("vector_store_info", {}),
                },
                "rag_metadata": {
                    "embedding_model": "text-embedding-3-small",
                    "embedding_dimension": 1536,
                    "used_project_api_key": bool(final_state.get("openai_api_key")),
                    "api_key_id": final_state.get("api_key_id"),
                    "processed_at": datetime.now(timezone.utc).isoformat(),
                    "duration": (
                        datetime.now(timezone.utc) - task_start_time
                    ).total_seconds(),
                },
                "lms_resource": {
                    "title": final_state.get("lms_resource", {}).get("title"),
                    "type": final_state.get("lms_resource", {}).get("target_type"),
                },
            }
        )
        session.add(agent_run)
        session.commit()
        session.refresh(agent_run)

        # Cleanup Redis
        await redis.delete(f"active_run:rag_chatbot:{agent_run.id}")

        duration = (datetime.now(timezone.utc) - task_start_time).total_seconds()
        logger.info(f"[RAG_CHATBOT] Completed in {duration:.1f}s")

        return {
            "agent_run_id": str(agent_run.id),
            "status": "completed",
            "duration": duration,
            "vector_store_id": final_state.get("vector_store_id"),
            "embeddings_count": final_state.get("embeddings_count", 0),
        }


__all__ = ["rag_chatbot_task"]

