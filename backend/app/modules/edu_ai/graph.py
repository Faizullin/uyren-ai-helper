"""
LangGraph Educational AI Workflow
Multi-step AI processing orchestration with state management
"""

import operator
from datetime import datetime, timezone
from typing import Annotated, Literal, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph import END, StateGraph
from openai import AsyncOpenAI
from sqlmodel import select

from app.core.db import get_db
from app.core.logger import logger
from app.models.api_key import APIKey
from app.modules.ai_models.manager import model_manager
from app.modules.vector_store.manager import vector_store_manager
from app.modules.vector_store.models import VectorStore, Document
from app.models.knowledge_base import KnowledgeBaseEntry

from .models import LMSResource, LMSResourceAttachment
from .tools.supabase_faiss import supabase_faiss_tool
from .utils import validate_api_key, check_api_key_access


class EducationalAIState(TypedDict):
    """
    State that flows through the educational AI workflow
    All nodes read from and write to this state
    """

    # Input IDs
    lms_resource_id: str  # LMSResource.id
    vector_store_id: str | None  # VectorStore.id for RAG operations
    project_id: str | None  # Project.id for context

    # Loaded data
    lms_resource: dict  # LMS resource configuration
    content_data: dict  # Content to process
    rag_context: str | None  # Retrieved knowledge base materials

    # AI analysis results
    analysis: dict  # Qualitative analysis
    processed_content: dict  # Processed content results

    # Final outputs
    result: dict  # Final processing result
    feedback: str  # Processing feedback

    # Workflow control
    messages: Annotated[list[BaseMessage], operator.add]  # Event log
    error: str | None
    retry_count: int


async def fetch_lms_resource_data(state: EducationalAIState) -> EducationalAIState:
    """
    NODE 1: Load LMS resource configuration and content data

    This node:
    1. Loads LMS resource from our database
    2. Extracts content and metadata
    3. Stores data in state for processing
    """
    logger.info(f"[EDU_AI] Fetching data for LMS resource {state['lms_resource_id']}")

    async with get_db() as session:
        # Load LMS resource
        lms_resource = await session.get(LMSResource, state["lms_resource_id"])
        if not lms_resource:
            return {**state, "error": "LMS resource not found"}

        logger.debug(f"[EDU_AI] LMS Resource: {lms_resource.title}")
        logger.debug(f"[EDU_AI] Target Type: {lms_resource.target_type}")
        logger.debug(f"[EDU_AI] Metadata: {lms_resource.my_metadata}")

        # Extract content data
        content_data = {
            "title": lms_resource.title,
            "description": lms_resource.description,
            "content": lms_resource.content,
            "thumbnail_url": lms_resource.thumbnail_url,
            "target_type": lms_resource.target_type,
            "target_id": str(lms_resource.target_id) if lms_resource.target_id else None,
            "metadata": lms_resource.my_metadata,
            "status": lms_resource.status,
            "is_public": lms_resource.is_public,
        }

        return {
            **state,
            "lms_resource": {
                "id": str(lms_resource.id),
                "title": lms_resource.title,
                "description": lms_resource.description,
                "target_type": lms_resource.target_type,
                "target_id": str(lms_resource.target_id) if lms_resource.target_id else None,
                "metadata": lms_resource.my_metadata,
                "status": lms_resource.status,
                "is_public": lms_resource.is_public,
                "created_at": lms_resource.created_at.isoformat(),
                "updated_at": lms_resource.updated_at.isoformat(),
            },
            "content_data": content_data,
            "messages": state["messages"]
            + [
                (
                    "system",
                    f"Loaded LMS resource: {lms_resource.title} (type: {lms_resource.target_type})",
                )
            ],
        }


async def retrieve_rag_context(state: EducationalAIState) -> EducationalAIState:
    """
    NODE 2: Retrieve relevant knowledge base materials for context (RAG)

    If vector store is available:
    1. Extract key terms from LMS resource content
    2. Search knowledge base using Supabase FAISS tool
    3. Return top N most relevant materials as context

    If no vector store: skip and return None
    """
    if not state.get("vector_store_id"):
        logger.debug("[EDU_AI] No vector store specified, skipping RAG context retrieval")
        return {**state, "rag_context": None}

    logger.info("[EDU_AI] Retrieving knowledge base materials via RAG")

    try:
        # Extract content for search
        content = state["content_data"].get("content", "")
        title = state["content_data"].get("title", "")

        if not content and not title:
            logger.warning("[EDU_AI] No content to search, skipping RAG")
            return {**state, "rag_context": None}

        # Use combined content for search
        search_query = f"{title} {content}"[:500]  # Limit search query length

        async with get_db() as session:
            # Use Supabase FAISS tool for vector search
            search_result = await supabase_faiss_tool.search_similar_content(
                session=session,
                vector_store_id=state["vector_store_id"],
                query_text=search_query,
                owner_id=state.get("owner_id", ""),  # You may need to pass owner_id in state
                similarity_threshold=0.7,
                max_results=5,
                target_type=state["lms_resource"].get("target_type"),
                target_id=state["lms_resource"].get("target_id"),
            )

            if search_result["status"] == "success" and search_result["results"]:
                # Format context from search results
                context_parts = []
                for result in search_result["results"]:
                    context_parts.append(
                        f"### {result['title']}\n"
                        f"Similarity: {result['similarity']:.2f}\n"
                        f"Type: {result['target_type']}\n"
                    )

                context = "\n\n".join(context_parts)
                logger.debug(f"[EDU_AI] Retrieved {len(search_result['results'])} relevant materials")
                
                return {
                    **state,
                    "rag_context": context,
                    "messages": state["messages"]
                    + [("system", f"Retrieved {len(search_result['results'])} relevant materials via RAG")],
                }

        return {**state, "rag_context": None}

    except Exception as e:
        logger.error(f"[EDU_AI] RAG error: {str(e)}")
        # Continue without RAG on error (graceful degradation)
        return {**state, "rag_context": None}


async def analyze_lms_content(state: EducationalAIState) -> EducationalAIState:
    """
    NODE 3: AI-powered content analysis

    Uses AI model to analyze LMS resource content:
    1. Identifies key concepts and themes
    2. Provides content quality assessment
    3. Suggests improvements and enhancements
    4. Uses RAG context for reference (if available)

    Output: Detailed content analysis
    """
    logger.info("[EDU_AI] Analyzing LMS content with AI")

    # Get AI model (default to a suitable model for content analysis)
    model_name = "gpt-4"  # You can make this configurable

    # Resolve model (handles aliases like "gpt-5" → actual model ID)
    resolved_model = model_manager.resolve_model_id(model_name)
    logger.debug(f"[EDU_AI] Using model: {resolved_model}")

    # Extract content
    content = state["content_data"].get("content", "")
    title = state["content_data"].get("title", "")
    description = state["content_data"].get("description", "")
    target_type = state["content_data"].get("target_type", "")

    # Build analysis prompt
    prompt = f"""You are an expert educational content analyst reviewing learning materials.

## Content Information
**Title:** {title}
**Description:** {description}
**Type:** {target_type}

## Content to Analyze
{content}
"""

    prompt += """

## Your Task
Analyze this educational content thoroughly:
1. **Key Concepts:** Identify main topics and learning objectives.
2. **Content Quality:** Assess clarity, organization, and educational value.
3. **Suggestions:** Specific recommendations for improvement.
4. **Overall Assessment:** Brief summary of content effectiveness.

Be constructive, specific, and focus on educational value."""

    try:
        # Call AI model
        # NOTE: Replace with your actual AI client implementation

        client = AsyncOpenAI()

        response = await client.chat.completions.create(
            model=resolved_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=4000,
        )

        analysis_text = response.choices[0].message.content

        logger.debug(f"[EDU_AI] Analysis complete ({len(analysis_text)} chars)")

        return {
            **state,
            "analysis": {
                "full_text": analysis_text,
                "model_used": resolved_model,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            "messages": state["messages"]
            + [("assistant", f"Content analysis complete using {resolved_model}")],
        }

    except Exception as e:
        logger.error(f"[EDU_AI] Analysis error: {str(e)}")
        return {**state, "error": f"Analysis failed: {str(e)}"}


async def process_content(state: EducationalAIState) -> EducationalAIState:
    """
    NODE 4: Process content and generate final result

    This node:
    1. Takes the analysis from previous node
    2. Processes the content based on type
    3. Generates structured output
    4. Provides final feedback

    Uses structured output (JSON) for consistent processing
    """
    logger.info("[EDU_AI] Processing content")

    # Get analysis from previous node
    analysis = state.get("analysis", {})
    content_data = state["content_data"]
    target_type = content_data.get("target_type", "")

    model_name = "gpt-4"  # You can make this configurable
    resolved_model = model_manager.resolve_model_id(model_name)

    # Build processing prompt based on content type
    logger.debug(f"[EDU_AI] Processing content type: {target_type}")

    prompt = f"""Process this educational content and provide structured output.

## Content Information
**Title:** {content_data.get('title', '')}
**Type:** {target_type}
**Description:** {content_data.get('description', '')}

## Content
{content_data.get('content', '')}

## Previous Analysis
{analysis.get('full_text', '')}

## Your Task
Process this content and return JSON with:
{
    "content_quality": {{
        "score": <0-100>,
        "assessment": "<brief quality assessment>"
    }},
    "key_concepts": ["<concept1>", "<concept2>", ...],
    "recommendations": ["<recommendation1>", "<recommendation2>", ...],
    "summary": "<brief summary of processing results>"
}

Focus on educational value and content effectiveness."""

    try:
        client = AsyncOpenAI()

        response = await client.chat.completions.create(
            model=resolved_model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},  # Force JSON
            temperature=0.2,  # Lower temp for consistency
        )

        import json

        processed_result = json.loads(response.choices[0].message.content)

        logger.info(f"[EDU_AI] Content processing complete")

        return {
            **state,
            "processed_content": processed_result,
            "result": processed_result,
            "messages": state["messages"]
            + [("assistant", f"Content processing complete")],
        }

    except Exception as e:
        logger.error(f"[EDU_AI] Processing error: {str(e)}")
        return {**state, "error": f"Processing failed: {str(e)}"}


async def generate_final_result(state: EducationalAIState) -> EducationalAIState:
    """
    NODE 5: Generate final educational content result

    Combines:
    1. Content analysis results
    2. Processing outcomes
    3. Recommendations and next steps

    Output: Formatted result ready for educational use
    """
    logger.info("[EDU_AI] Generating final result")

    # Get processed content results
    processed_content = state.get("processed_content", {})
    analysis = state.get("analysis", {})
    lms_resource = state["lms_resource"]

    # Build final result message
    result_parts = [
        f"# Content Analysis: {lms_resource['title']}",
        f"**Type:** {lms_resource.get('target_type', 'Unknown')}",
        "",
        "## Analysis Summary",
        analysis.get("full_text", "No analysis available"),
        "",
    ]

    # Add processed results if available
    if processed_content:
        if "content_quality" in processed_content:
            quality = processed_content["content_quality"]
            result_parts.append(f"## Quality Assessment: {quality.get('score', 0)}/100")
            result_parts.append(f"{quality.get('assessment', 'No assessment available')}")
            result_parts.append("")

        if "key_concepts" in processed_content:
            result_parts.append("## Key Concepts Identified")
            for concept in processed_content["key_concepts"]:
                result_parts.append(f"- {concept}")
            result_parts.append("")

        if "recommendations" in processed_content:
            result_parts.append("## Recommendations")
            for rec in processed_content["recommendations"]:
                result_parts.append(f"- {rec}")
            result_parts.append("")

        if "summary" in processed_content:
            result_parts.append("## Summary")
            result_parts.append(processed_content["summary"])
            result_parts.append("")

    # Add encouragement based on quality score
    quality_score = processed_content.get("content_quality", {}).get("score", 0)
    if quality_score >= 80:
        result_parts.append("🌟 Excellent educational content! Well-structured and valuable.")
    elif quality_score >= 60:
        result_parts.append("✅ Good content! Consider the recommendations for enhancement.")
    elif quality_score >= 40:
        result_parts.append("📚 Content needs improvement. Review the recommendations above.")
    else:
        result_parts.append("💡 Content requires significant revision. Focus on the key areas mentioned.")

    feedback = "\n".join(result_parts)

    return {
        **state,
        "feedback": feedback,
        "messages": state["messages"] + [("assistant", "Feedback generated")],
    }


async def save_results(state: EducationalAIState) -> EducationalAIState:
    """
    NODE 6: Save educational AI processing results to database

    Updates the LMSResource with:
    1. Processing results
    2. Analysis feedback
    3. Quality assessment
    4. Metadata (model used, timestamp, etc.)

    Sets status to 'processed' or updates metadata
    """
    logger.info("[EDU_AI] Saving results")

    async with get_db() as session:
        lms_resource = await session.get(LMSResource, state["lms_resource_id"])
        if not lms_resource:
            return {**state, "error": "LMS resource not found"}

        # Update with results
        lms_resource.updated_at = datetime.now(timezone.utc)

        # Store results in metadata field
        processing_results = {
            "feedback": state["feedback"],
            "analysis": state.get("analysis", {}).get("full_text", ""),
            "processed_content": state.get("processed_content", {}),
            "model_used": state.get("analysis", {}).get("model_used", ""),
            "processed_by": "ai",
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }

        # Update metadata with processing results
        current_metadata = lms_resource.my_metadata or {}
        current_metadata["ai_processing"] = processing_results
        lms_resource.my_metadata = current_metadata

        session.add(lms_resource)
        await session.commit()

        logger.info(f"[EDU_AI] Saved results for LMS resource {state['lms_resource_id']}")

        return {
            **state,
            "messages": state["messages"] + [("assistant", "Results saved successfully")],
        }

def should_continue_processing(state: EducationalAIState) -> Literal["continue", "complete"]:
    """
    Conditional edge: Determine if processing should continue

    Checks:
    1. If analysis was successful
    2. If content processing completed
    3. Error conditions

    Returns:
    - "continue": Continue to next step
    - "complete": Complete processing
    """
    if state.get("error"):
        logger.info("[EDU_AI] Error detected, completing processing")
        return "complete"

    if state.get("analysis") and state.get("processed_content"):
        logger.info("[EDU_AI] All processing steps completed successfully")
        return "complete"

    return "continue"


def create_educational_ai_graph():
    """
    Build the LangGraph educational AI workflow

    Flow:
    START → fetch_lms_resource_data → retrieve_rag_context → analyze_lms_content
          → process_content → generate_final_result → save_results → END

    Optional RAG context retrieval based on vector store availability
    """
    workflow = StateGraph(EducationalAIState)

    # Add all nodes
    workflow.add_node("fetch", fetch_lms_resource_data)
    workflow.add_node("retrieve_context", retrieve_rag_context)
    workflow.add_node("analyze", analyze_lms_content)
    workflow.add_node("process", process_content)
    workflow.add_node("final_result", generate_final_result)
    workflow.add_node("save", save_results)

    # Define edges (flow)
    workflow.set_entry_point("fetch")
    workflow.add_edge("fetch", "retrieve_context")
    workflow.add_edge("retrieve_context", "analyze")
    workflow.add_edge("analyze", "process")
    workflow.add_edge("process", "final_result")
    workflow.add_edge("final_result", "save")
    workflow.add_edge("save", END)

    # Compile workflow without checkpointing
    return workflow.compile()


# Export compiled graph
educational_ai_graph = create_educational_ai_graph()
