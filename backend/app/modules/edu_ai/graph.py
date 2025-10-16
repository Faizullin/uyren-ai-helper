"""
LangGraph Grading Workflow
Multi-step AI grading orchestration with state management
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

from .models import Assignment, CourseMaterial, GradingSession
from .thirdparty import create_client


class GradingState(TypedDict):
    """
    State that flows through the grading workflow
    All nodes read from and write to this state
    """

    # Input IDs
    session_id: str  # GradingSession.id
    assignment_id: str  # Assignment.id

    # Loaded data
    assignment: dict  # Assignment configuration
    thirdparty_data: dict  # Student submission from external API
    rag_context: str | None  # Retrieved course materials

    # AI analysis results
    analysis: dict  # Qualitative analysis
    grade_breakdown: dict  # Per-criterion scores

    # Final outputs
    total_grade: float
    feedback: str

    # Workflow control
    messages: Annotated[list[BaseMessage], operator.add]  # Event log
    error: str | None
    retry_count: int


async def fetch_assignment_data(state: GradingState) -> GradingState:
    """
    NODE 1: Load assignment configuration and third-party submission data

    This node:
    1. Loads assignment settings from our database
    2. Calls third-party API to fetch student submission
    3. Stores raw data in state for processing

    The third-party data is stored as-is (no schema assumptions)
    """
    logger.info(f"[GRADING] Fetching data for session {state['session_id']}")

    async with get_db() as session:
        # Load grading session
        grading_session = await session.get(GradingSession, state["session_id"])
        if not grading_session:
            return {**state, "error": "Grading session not found"}

        # Load assignment configuration
        assignment = await session.get(Assignment, state["assignment_id"])
        if not assignment:
            return {**state, "error": "Assignment not found"}

        logger.debug(f"[GRADING] Assignment: {assignment.title}")
        logger.debug(f"[GRADING] Settings: {assignment.settings}")

        # Check if we already have third-party data (might be pre-loaded)
        if grading_session.thirdparty_data:
            thirdparty_data = grading_session.thirdparty_data
            logger.debug("[GRADING] Using pre-loaded third-party data")
        else:
            # Fetch from third-party API
            logger.info("[GRADING] Fetching from third-party API")

            client = create_client(
                assignment.thirdparty_api_url, assignment.thirdparty_api_key
            )

            # Assume thirdparty_data contains the submission_id to fetch
            # OR fetch by student ID, assignment ID, etc.
            # This depends on your third-party API structure
            submission_id = grading_session.thirdparty_data.get("submission_id")
            if submission_id:
                thirdparty_data = await client.fetch_single_submission(submission_id)
            else:
                return {**state, "error": "No submission ID provided"}

            # Update session with fetched data
            grading_session.thirdparty_data = thirdparty_data
            session.add(grading_session)
            await session.commit()

        return {
            **state,
            "assignment": {
                "title": assignment.title,
                "description": assignment.description,
                "assignment_type": assignment.assignment_type,
                "questions": assignment.questions,
                "settings": assignment.settings,
                "thirdparty_api_url": assignment.thirdparty_api_url,
                "thirdparty_webhook_url": assignment.thirdparty_webhook_url,
                "api_key_id": str(assignment.api_key_id)
                if assignment.api_key_id
                else None,
            },
            "thirdparty_data": thirdparty_data,
            "messages": state["messages"]
            + [
                (
                    "system",
                    f"Loaded assignment: {assignment.title} (type: {assignment.assignment_type})",
                )
            ],
        }


async def retrieve_rag_context(state: GradingState) -> GradingState:
    """
    NODE 2: Retrieve relevant course materials for context (RAG)

    If RAG is enabled in assignment settings:
    1. Extract key terms from student submission
    2. Search course materials using vector similarity
    3. Return top N most relevant materials as context

    If RAG is disabled: skip and return None
    """
    use_rag = state["assignment"]["settings"].get("use_rag", False)

    if not use_rag:
        logger.debug("[GRADING] RAG disabled, skipping context retrieval")
        return {**state, "rag_context": None}

    logger.info("[GRADING] Retrieving course materials via RAG")

    try:
        # Extract submission content (handle different structures)
        submission_content = ""
        if "submission" in state["thirdparty_data"]:
            submission_content = state["thirdparty_data"]["submission"].get(
                "content", ""
            )
        elif "content" in state["thirdparty_data"]:
            submission_content = state["thirdparty_data"]["content"]

        if not submission_content:
            logger.warning("[GRADING] No content to search, skipping RAG")
            return {**state, "rag_context": None}

        # TODO: Implement vector similarity search when pgvector is enabled
        # For now, return placeholder
        logger.warning("[GRADING] Vector search not implemented, using simple search")

        async with get_db() as session:
            # Simple keyword search (replace with vector search later)
            result = await session.execute(
                select(CourseMaterial)
                .where(CourseMaterial.assignment_id == state["assignment_id"])
                .limit(3)
            )
            materials = result.scalars().all()

            if materials:
                context = "\n\n".join(
                    [
                        f"### {mat.title}\n{mat.content[:500]}..."  # First 500 chars
                        for mat in materials
                    ]
                )
                logger.debug(f"[GRADING] Retrieved {len(materials)} materials")
                return {
                    **state,
                    "rag_context": context,
                    "messages": state["messages"]
                    + [("system", f"Retrieved {len(materials)} reference materials")],
                }

        return {**state, "rag_context": None}

    except Exception as e:
        logger.error(f"[GRADING] RAG error: {str(e)}")
        # Continue without RAG on error (graceful degradation)
        return {**state, "rag_context": None}


async def analyze_submission(state: GradingState) -> GradingState:
    """
    NODE 3: AI-powered qualitative analysis

    Uses AI model to analyze submission quality:
    1. Identifies strengths and weaknesses
    2. Provides specific, actionable feedback
    3. Considers rubric criteria (if provided)
    4. Uses RAG context for reference (if available)

    Output: Detailed text analysis (not scores yet)
    """
    logger.info("[GRADING] Analyzing submission with AI")

    # Get AI model from settings
    model_name = state["assignment"]["settings"].get("grading_model", "gpt-5-mini")
    teacher_instructions = state["assignment"]["settings"].get(
        "teacher_instructions", ""
    )

    # Resolve model (handles aliases like "gpt-5" → actual model ID)
    resolved_model = model_manager.resolve_model_id(model_name)
    logger.debug(f"[GRADING] Using model: {resolved_model}")

    # Extract submission content
    if "submission" in state["thirdparty_data"]:
        content = state["thirdparty_data"]["submission"].get("content", "")
        files = state["thirdparty_data"]["submission"].get("files", [])
    else:
        content = state["thirdparty_data"].get("content", "")
        files = state["thirdparty_data"].get("files", [])

    # Build analysis prompt
    prompt = f"""You are an expert teaching assistant grading student work.

## Assignment
**Title:** {state["assignment"]["title"]}
**Description:** {state["assignment"]["description"]}

## Student Submission
{content}
"""

    # Add file references if present
    if files:
        prompt += f"\n**Attached Files:** {len(files)} file(s)\n"
        for i, file_url in enumerate(files, 1):
            prompt += f"{i}. {file_url}\n"

    # Add teacher instructions
    if teacher_instructions:
        prompt += f"""

## Additional Teacher Instructions
{teacher_instructions}
"""

    # Add RAG context if available
    if state.get("rag_context"):
        prompt += f"""

## Reference Materials (for context)
{state["rag_context"]}
"""

    prompt += """

## Your Task
Analyze this submission thoroughly:
1. **Strengths:** What did the student do well? Be specific.
2. **Weaknesses:** What needs improvement? Provide examples.
3. **Suggestions:** Specific, actionable feedback for improvement.
4. **Overall Assessment:** Brief summary of quality.

Be constructive, specific, and encouraging.
Focus on learning, not just grading."""

    try:
        # Call AI model
        # NOTE: Replace with your actual AI client implementation

        client = AsyncOpenAI()

        response = await client.chat.completions.create(
            model=resolved_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=state["assignment"]["settings"].get("temperature", 0.3),
            max_tokens=state["assignment"]["settings"].get("max_tokens", 4000),
        )

        analysis_text = response.choices[0].message.content

        logger.debug(f"[GRADING] Analysis complete ({len(analysis_text)} chars)")

        return {
            **state,
            "analysis": {
                "full_text": analysis_text,
                "model_used": resolved_model,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
            "messages": state["messages"]
            + [("assistant", f"Analysis complete using {resolved_model}")],
        }

    except Exception as e:
        logger.error(f"[GRADING] Analysis error: {str(e)}")
        return {**state, "error": f"Analysis failed: {str(e)}"}


async def calculate_grade(state: GradingState) -> GradingState:
    """
    NODE 4: Calculate numerical grade based on rubric

    Two modes:
    1. Rubric-based: AI assigns points for each criterion
    2. Holistic: AI assigns overall score (0-100)

    Uses structured output (JSON) for consistent grading
    """
    logger.info("[GRADING] Calculating grade")

    rubric = state["assignment"]["settings"].get("rubric")
    max_points = state["assignment"]["settings"].get("max_points", 100)

    # Extract submission content
    if "submission" in state["thirdparty_data"]:
        content = state["thirdparty_data"]["submission"].get("content", "")
    else:
        content = state["thirdparty_data"].get("content", "")

    model_name = state["assignment"]["settings"].get("grading_model", "gpt-5-mini")
    resolved_model = model_manager.resolve_model_id(model_name)

    if rubric:
        # Rubric-based grading
        logger.debug("[GRADING] Using rubric-based grading")

        prompt = f"""Grade this submission using the rubric.

## Assignment
{state["assignment"]["title"]}

## Student Submission
{content}

## Previous Analysis
{state["analysis"]["full_text"]}

## Grading Rubric
"""
        # Add each criterion
        for criterion, points in rubric.items():
            prompt += f"- **{criterion}**: {points} points\n"

        prompt += """

## Your Task
Assign points for each criterion. Return JSON:
{
    "criterion_name": {
        "score": <points earned>,
        "max": <max points>,
        "reason": "<brief justification>"
    }
}

Be fair, consistent, and evidence-based."""

    else:
        # Holistic grading
        logger.debug("[GRADING] Using holistic grading")

        prompt = f"""Grade this submission on a 0-{max_points} scale.

## Assignment
{state["assignment"]["title"]}

## Student Submission
{content}

## Previous Analysis
{state["analysis"]["full_text"]}

## Your Task
Assign a numerical grade (0-{max_points}). Return JSON:
{{
    "overall": {{
        "score": <points earned>,
        "max": {max_points},
        "reason": "<2-3 sentence justification>"
    }}
}}

Be fair and consistent."""

    try:
        client = AsyncOpenAI()

        response = await client.chat.completions.create(
            model=resolved_model,
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},  # Force JSON
            temperature=0.2,  # Lower temp for consistency
        )

        import json

        grade_breakdown = json.loads(response.choices[0].message.content)

        # Calculate total
        if rubric:
            total_score = sum(item["score"] for item in grade_breakdown.values())
            total_possible = sum(item["max"] for item in grade_breakdown.values())
            total_grade = (total_score / total_possible) * max_points
        else:
            total_grade = grade_breakdown["overall"]["score"]

        logger.info(f"[GRADING] Final grade: {total_grade:.1f}/{max_points}")

        return {
            **state,
            "grade_breakdown": grade_breakdown,
            "total_grade": round(total_grade, 2),
            "messages": state["messages"]
            + [("assistant", f"Grade: {total_grade:.1f}/{max_points}")],
        }

    except Exception as e:
        logger.error(f"[GRADING] Grading error: {str(e)}")
        return {**state, "error": f"Grading failed: {str(e)}"}


async def generate_feedback(state: GradingState) -> GradingState:
    """
    NODE 5: Generate final student-facing feedback

    Combines:
    1. Grade and rubric breakdown
    2. Qualitative analysis
    3. Encouragement and next steps

    Output: Formatted feedback ready to show student
    """
    logger.info("[GRADING] Generating feedback")

    max_points = state["assignment"]["settings"].get("max_points", 100)

    # Build feedback message
    feedback_parts = [
        f"# Grade: {state['total_grade']:.1f}/{max_points}",
        "",
        "## Assessment",
        state["analysis"]["full_text"],
        "",
    ]

    # Add rubric breakdown if present
    if state.get("grade_breakdown") and len(state["grade_breakdown"]) > 1:
        feedback_parts.append("## Score Breakdown")
        for criterion, details in state["grade_breakdown"].items():
            if criterion != "overall":
                feedback_parts.append(
                    f"**{criterion}:** {details['score']}/{details['max']} - {details['reason']}"
                )
        feedback_parts.append("")

    # Add encouragement based on grade
    grade_percent = (state["total_grade"] / max_points) * 100
    if grade_percent >= 90:
        feedback_parts.append("🌟 Excellent work! You've demonstrated strong mastery.")
    elif grade_percent >= 70:
        feedback_parts.append("✅ Good effort! Review the feedback to improve further.")
    elif grade_percent >= 50:
        feedback_parts.append("📚 Keep working! Focus on the areas highlighted above.")
    else:
        feedback_parts.append(
            "💡 This needs more work. Please review the materials and try again."
        )

    feedback = "\n".join(feedback_parts)

    return {
        **state,
        "feedback": feedback,
        "messages": state["messages"] + [("assistant", "Feedback generated")],
    }


async def save_results(state: GradingState) -> GradingState:
    """
    NODE 6: Save grading results to database

    Updates the GradingSession with:
    1. Final grade
    2. Feedback text
    3. Detailed rubric scores
    4. Metadata (model used, timestamp, etc.)

    Sets status to 'graded' (or 'reviewed' if manual review needed)
    """
    logger.info("[GRADING] Saving results")

    async with get_db() as session:
        grading_session = await session.get(GradingSession, state["session_id"])
        if not grading_session:
            return {**state, "error": "Session not found"}

        # Update with results
        grading_session.status = "graded"
        grading_session.progress = 100
        grading_session.completed_at = datetime.now(timezone.utc)
        grading_session.updated_at = datetime.now(timezone.utc)

        # Store results in JSONB field
        grading_session.results = {
            "grade": state["total_grade"],
            "max_points": state["assignment"]["settings"].get("max_points", 100),
            "feedback": state["feedback"],
            "rubric_scores": state.get("grade_breakdown", {}),
            "analysis": state["analysis"]["full_text"],
            "model_used": state["analysis"]["model_used"],
            "graded_by": "ai",
            "graded_at": datetime.now(timezone.utc).isoformat(),
        }

        session.add(grading_session)
        await session.commit()

        logger.info(f"[GRADING] Saved results for session {state['session_id']}")

        # Submit grade back to third-party via webhook if configured
        if state.get("assignment", {}).get("thirdparty_webhook_url"):
            try:
                logger.info("[GRADING] Submitting grade via webhook")

                # Get API key for webhook auth
                webhook_url = state["assignment"]["thirdparty_webhook_url"]
                api_key = None
                if state["assignment"].get("api_key_id"):
                    async with get_db() as db_session:
                        api_key_obj = await db_session.get(
                            APIKey, state["assignment"]["api_key_id"]
                        )
                        if api_key_obj:
                            api_key = api_key_obj.public_key

                # Get submission ID from third-party data
                submission_id = state["thirdparty_data"].get("submission_id")
                if submission_id:
                    client = create_client(
                        state["assignment"]["thirdparty_api_url"], api_key
                    )
                    await client.submit_grade_webhook(
                        webhook_url=webhook_url,
                        submission_id=submission_id,
                        grade_data=grading_session.results,
                    )
                    logger.info(
                        f"[GRADING] Successfully submitted grade for {submission_id}"
                    )
            except Exception as e:
                logger.error(f"[GRADING] Webhook submission failed: {str(e)}")
                # Don't fail the whole grading process if webhook fails

        return {
            **state,
            "messages": state["messages"] + [("system", "Results saved successfully")],
        }


def should_require_review(state: GradingState) -> Literal["review", "save"]:
    """
    Conditional edge: Determine if human review is needed

    Checks:
    1. Assignment setting: require_manual_review
    2. Grade threshold: borderline passes/fails
    3. Error conditions: if something went wrong

    Returns:
    - "review": Pause for human approval
    - "save": Save directly
    """
    require_review = state["assignment"]["settings"].get("require_manual_review", False)

    if require_review:
        logger.info("[GRADING] Manual review required by settings")
        return "review"

    # Check for borderline grades (e.g., within 5% of passing)
    max_points = state["assignment"]["settings"].get("max_points", 100)
    passing_grade = max_points * 0.6  # 60% = passing
    grade = state["total_grade"]

    if abs(grade - passing_grade) <= max_points * 0.05:
        logger.info(f"[GRADING] Borderline grade ({grade:.1f}), flagging for review")
        return "review"

    return "save"


def create_grading_graph():
    """
    Build the LangGraph workflow

    Flow:
    START → fetch_assignment_data → retrieve_rag_context → analyze_submission
          → calculate_grade → generate_feedback → [review?] → save_results → END

    The [review?] is a conditional branch based on settings
    """
    workflow = StateGraph(GradingState)

    # Add all nodes
    workflow.add_node("fetch", fetch_assignment_data)
    workflow.add_node("retrieve_context", retrieve_rag_context)
    workflow.add_node("analyze", analyze_submission)
    workflow.add_node("grade", calculate_grade)
    workflow.add_node("feedback", generate_feedback)
    workflow.add_node("review", lambda s: {**s})  # Pauses for human input
    workflow.add_node("save", save_results)

    # Define edges (flow)
    workflow.set_entry_point("fetch")
    workflow.add_edge("fetch", "retrieve_context")
    workflow.add_edge("retrieve_context", "analyze")
    workflow.add_edge("analyze", "grade")
    workflow.add_edge("grade", "feedback")

    # Conditional: review or save directly?
    workflow.add_conditional_edges(
        "feedback",
        should_require_review,
        {
            "review": "review",
            "save": "save",
        },
    )

    workflow.add_edge("review", "save")
    workflow.add_edge("save", END)

    # Compile workflow without checkpointing
    return workflow.compile()


# Export compiled graph
grading_graph = create_grading_graph()
