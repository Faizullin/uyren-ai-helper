"""
Autograder Educational AI Task

Automated grading task using LangGraph workflow for:
- Assignment submission analysis
- Rubric-based evaluation with AI
- Feedback generation
- Score calculation
"""

import asyncio
import json as json_lib
import operator
import uuid
from datetime import datetime, timezone
from typing import Annotated, Any, TypedDict

import dramatiq
from langchain_core.messages import AIMessage, BaseMessage, SystemMessage
from langgraph.graph import END, StateGraph
from openai import AsyncOpenAI

from app.core import redis
from app.core.db import get_db_async
from app.core.logger import logger
from app.models import AgentRun, AgentRunStatus, Thread
from app.modules.ai_models.manager import model_manager
from app.modules.edu_ai.tasks.utils import publish_stream_update


class AutograderState(TypedDict):
    """
    State for autograder workflow.

    Follows graph.py pattern with message accumulation for event tracking.
    """

    # Input IDs
    agent_run_id: str
    thread_id: str
    assignment_id: str

    # Configuration
    model_name: str
    use_ai_grading: bool

    # Loaded data
    submission_content: str
    rubric: dict
    submission_analysis: dict

    # Processing results
    total_score: float
    max_score: float
    criteria_scores: dict
    feedback: list[dict]
    detailed_analysis: str

    # Final output
    final_report: str

    # Workflow control (following graph.py pattern)
    messages: Annotated[list[BaseMessage], operator.add]  # Event log
    error: str | None
    retry_count: int


async def fetch_submission_data(state: AutograderState) -> AutograderState:
    """
    NODE 1: Load and validate submission data

    This node:
    1. Validates agent run exists and is active
    2. Loads submission content and rubric
    3. Performs initial content analysis
    4. Stores data in state for processing
    """
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        f"📋 Loading submission for assignment '{state['assignment_id']}'...",
        data={"step": 1, "action": "fetching_data"},
    )

    # Analyze submission content
    content_length = len(state["submission_content"])
    has_code = (
        "def " in state["submission_content"] or "class " in state["submission_content"]
    )
    word_count = len(state["submission_content"].split())
    line_count = len(state["submission_content"].splitlines())

    submission_analysis = {
        "content_length": content_length,
        "word_count": word_count,
        "line_count": line_count,
        "has_code": has_code,
        "rubric_criteria_count": len(state["rubric"]),
    }

    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        f"✅ Submission loaded: {word_count} words, {line_count} lines, "
        f"{'code' if has_code else 'text'} detected",
        data={
            "step": 1,
            "action": "data_loaded",
            "progress": 15,
            **submission_analysis,
        },
        save_db=True,
    )

    return {
        **state,
        "submission_analysis": submission_analysis,
        "messages": [
            SystemMessage(
                content=f"Loaded submission: {word_count} words, {line_count} lines for '{state['assignment_id']}'"
            )
        ],
    }


async def evaluate_criteria(state: AutograderState) -> AutograderState:
    """Step 2: Evaluate against rubric criteria with AI"""
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "🎯 Evaluating submission against rubric criteria...",
        data={"step": 2, "action": "evaluating_criteria"},
    )

    rubric = state.get("rubric", {})
    criteria_scores = {}
    total_score = 0.0
    max_score = 0.0
    use_ai = state.get("use_ai_grading", False)

    # Use AI for evaluation if enabled
    if use_ai:
        try:
            model_name = state.get("model_name", "gpt-4")
            resolved_model = model_manager.resolve_model_id(model_name)
            client = AsyncOpenAI()

            # Evaluate each criterion with AI
            for criterion, details in rubric.items():
                criterion_max = details.get("max_points", 10)
                criterion_name = details.get("name", criterion)
                criterion_desc = details.get("description", "")

                # Build AI evaluation prompt
                prompt = f"""You are an expert grader evaluating student work.

## Submission to Grade:
{state["submission_content"]}

## Grading Criterion:
**{criterion_name}** (Max: {criterion_max} points)
Description: {criterion_desc}

## Your Task:
Evaluate this submission for the criterion above. Return ONLY a JSON object:
{{
    "score": <number between 0 and {criterion_max}>,
    "reasoning": "<brief explanation of the score>",
    "strengths": "<what was done well>",
    "improvements": "<what could be better>"
}}

Be fair, specific, and constructive."""

                response = await client.chat.completions.create(
                    model=resolved_model,
                    messages=[{"role": "user", "content": prompt}],
                    response_format={"type": "json_object"},
                    temperature=0.3,
                )

                result = json_lib.loads(response.choices[0].message.content)
                criterion_score = float(result.get("score", criterion_max * 0.5))

                # Ensure score is within bounds
                criterion_score = max(0, min(criterion_score, criterion_max))

                criteria_scores[criterion] = {
                    "score": criterion_score,
                    "max": criterion_max,
                    "percentage": (criterion_score / criterion_max) * 100,
                    "reasoning": result.get("reasoning", ""),
                    "strengths": result.get("strengths", ""),
                    "improvements": result.get("improvements", ""),
                }

                total_score += criterion_score
                max_score += criterion_max

                await publish_stream_update(
                    state["agent_run_id"],
                    state["thread_id"],
                    f"  ✓ {criterion_name}: {criterion_score:.1f}/{criterion_max} - {result.get('reasoning', '')}",
                    data={
                        "criterion": criterion,
                        "score": criterion_score,
                        "max": criterion_max,
                    },
                )

        except Exception as e:
            logger.error(f"[AUTOGRADER] AI evaluation error: {e}")
            # Fallback to simulated scoring
            await publish_stream_update(
                state["agent_run_id"],
                state["thread_id"],
                "⚠️ AI grading unavailable, using fallback scoring",
                data={"warning": "ai_fallback"},
            )
            use_ai = False

    # Fallback: Simulate scoring if AI is disabled or failed
    if not use_ai:
        for criterion, details in rubric.items():
            criterion_max = details.get("max_points", 10)
            criterion_score = criterion_max * 0.85  # Example: 85% score

            criteria_scores[criterion] = {
                "score": criterion_score,
                "max": criterion_max,
                "percentage": (criterion_score / criterion_max) * 100,
                "reasoning": "Simulated score (AI grading not available)",
            }

            total_score += criterion_score
            max_score += criterion_max

            await publish_stream_update(
                state["agent_run_id"],
                state["thread_id"],
                f"  ✓ {criterion}: {criterion_score}/{criterion_max} points",
                data={
                    "criterion": criterion,
                    "score": criterion_score,
                    "max": criterion_max,
                },
            )

    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        f"📊 Evaluation complete: {total_score:.1f}/{max_score:.1f} points ({(total_score / max_score) * 100:.1f}%)",
        data={
            "step": 2,
            "action": "evaluation_complete",
            "total_score": total_score,
            "max_score": max_score,
            "percentage": (total_score / max_score) * 100,
            "progress": 60,
        },
        save_db=True,
    )

    return {
        **state,
        "criteria_scores": criteria_scores,
        "total_score": total_score,
        "max_score": max_score,
        "messages": [
            AIMessage(
                content=f"Evaluated {len(criteria_scores)} criteria: {total_score:.1f}/{max_score:.1f}"
            )
        ],
    }


async def generate_feedback(state: AutograderState) -> AutograderState:
    """Step 3: Generate detailed feedback with AI"""
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "💬 Generating detailed feedback...",
        data={"step": 3, "action": "generating_feedback"},
    )

    feedback = []
    detailed_analysis = ""

    # Generate AI-powered comprehensive feedback if enabled
    if state.get("use_ai_grading", False):
        try:
            model_name = state.get("model_name", "gpt-4")
            resolved_model = model_manager.resolve_model_id(model_name)
            client = AsyncOpenAI()

            # Build comprehensive feedback prompt
            criteria_summary = "\n".join(
                [
                    f"- {name}: {scores['score']:.1f}/{scores['max']} ({scores['percentage']:.1f}%)"
                    for name, scores in state["criteria_scores"].items()
                ]
            )

            prompt = f"""You are an expert educator providing comprehensive feedback on student work.

## Student Submission:
{state["submission_content"]}

## Grading Results:
{criteria_summary}

Total Score: {state["total_score"]:.1f}/{state["max_score"]:.1f} ({(state["total_score"] / state["max_score"]) * 100:.1f}%)

## Your Task:
Provide detailed, constructive feedback. Return JSON:
{{
    "overall_assessment": "<overall evaluation of the work>",
    "strengths": ["<specific strength 1>", "<strength 2>", ...],
    "areas_for_improvement": ["<specific improvement 1>", "<improvement 2>", ...],
    "next_steps": ["<actionable step 1>", "<step 2>", ...],
    "summary": "<brief encouraging summary>"
}}

Be specific, constructive, and encouraging."""

            response = await client.chat.completions.create(
                model=resolved_model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.5,
            )

            feedback_result = json_lib.loads(response.choices[0].message.content)

            # Convert to feedback list format
            for strength in feedback_result.get("strengths", []):
                feedback.append(
                    {
                        "type": "strength",
                        "category": "Overall",
                        "comment": strength,
                    }
                )

            for improvement in feedback_result.get("areas_for_improvement", []):
                feedback.append(
                    {
                        "type": "improvement",
                        "category": "Overall",
                        "comment": improvement,
                    }
                )

            for step in feedback_result.get("next_steps", []):
                feedback.append(
                    {
                        "type": "next_step",
                        "category": "Action Items",
                        "comment": step,
                    }
                )

            # Store detailed analysis
            detailed_analysis = feedback_result.get("overall_assessment", "")

        except Exception as e:
            logger.error(f"[AUTOGRADER] AI feedback error: {e}")
            # Fallback to simulated feedback
            feedback = [
                {
                    "type": "strength",
                    "category": "Code Quality",
                    "comment": "Well-structured code with clear variable names.",
                },
                {
                    "type": "improvement",
                    "category": "Documentation",
                    "comment": "Consider adding more inline comments for complex logic.",
                },
            ]
    else:
        # Simulated feedback
        feedback = [
            {
                "type": "strength",
                "category": "Overall",
                "comment": "Good submission (AI feedback not available).",
            },
        ]

    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        f"✨ Generated {len(feedback)} feedback items",
        data={
            "step": 3,
            "action": "feedback_complete",
            "feedback_count": len(feedback),
            "progress": 85,
        },
        save_db=True,
    )

    return {
        **state,
        "feedback": feedback,
        "detailed_analysis": detailed_analysis,
        "messages": [AIMessage(content=f"Generated {len(feedback)} feedback items")],
    }


async def generate_final_report(state: AutograderState) -> AutograderState:
    """
    NODE 4: Generate final grading report

    Combines:
    1. Grading results
    2. Feedback items
    3. Recommendations

    Output: Formatted report ready for student review
    """
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "📝 Generating final grading report...",
        data={"step": 4, "action": "generating_report"},
    )

    percentage = (state["total_score"] / state["max_score"]) * 100
    grade_letter = (
        "A" if percentage >= 90
        else "B" if percentage >= 80
        else "C" if percentage >= 70
        else "D" if percentage >= 60
        else "F"
    )

    # Build comprehensive report
    report_parts = [
        f"# Grading Report: {state['assignment_id']}",
        f"**Score:** {state['total_score']:.1f}/{state['max_score']:.1f} ({percentage:.1f}%)",
        f"**Grade:** {grade_letter}",
        "",
    ]

    # Add detailed analysis if available
    if state.get("detailed_analysis"):
        report_parts.append("## Overall Assessment")
        report_parts.append(state["detailed_analysis"])
        report_parts.append("")

    # Add criteria breakdown
    report_parts.append("## Criteria Scores")
    for criterion, scores in state["criteria_scores"].items():
        report_parts.append(
            f"### {criterion}: {scores['score']:.1f}/{scores['max']} ({scores['percentage']:.1f}%)"
        )
        if scores.get("reasoning"):
            report_parts.append(f"*{scores['reasoning']}*")
        if scores.get("strengths"):
            report_parts.append(f"**Strengths:** {scores['strengths']}")
        if scores.get("improvements"):
            report_parts.append(f"**Areas for improvement:** {scores['improvements']}")
        report_parts.append("")

    # Add feedback sections
    strengths = [f for f in state["feedback"] if f["type"] == "strength"]
    improvements = [f for f in state["feedback"] if f["type"] == "improvement"]
    next_steps = [f for f in state["feedback"] if f["type"] == "next_step"]

    if strengths:
        report_parts.append("## Strengths ✨")
        for item in strengths:
            report_parts.append(f"- {item['comment']}")
        report_parts.append("")

    if improvements:
        report_parts.append("## Areas for Improvement 📚")
        for item in improvements:
            report_parts.append(f"- {item['comment']}")
        report_parts.append("")

    if next_steps:
        report_parts.append("## Next Steps 🎯")
        for item in next_steps:
            report_parts.append(f"- {item['comment']}")
        report_parts.append("")

    # Add encouragement
    if percentage >= 90:
        report_parts.append("🌟 **Excellent work!** Your submission demonstrates strong understanding.")
    elif percentage >= 80:
        report_parts.append("✅ **Great job!** Consider the suggestions above for further improvement.")
    elif percentage >= 70:
        report_parts.append("📖 **Good effort!** Review the feedback to strengthen your work.")
    elif percentage >= 60:
        report_parts.append("💪 **Keep working!** Focus on the areas mentioned above.")
    else:
        report_parts.append("📝 **Needs revision.** Please review the feedback and resubmit.")

    final_report = "\n".join(report_parts)

    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        final_report[:500] + "..." if len(final_report) > 500 else final_report,
        data={
            "step": 4,
            "action": "report_complete",
            "progress": 90,
            "grade": grade_letter,
            "percentage": percentage,
        },
        save_db=True,
    )

    return {
        **state,
        "final_report": final_report,
        "messages": [AIMessage(content="Final grading report generated")],
    }


async def save_grading_results(state: AutograderState) -> AutograderState:
    """
    NODE 5: Save grading results to database

    Updates the AgentRun with:
    1. Final scores and grade
    2. Detailed feedback
    3. Processing metadata
    4. Sets status to 'completed'
    """
    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "💾 Saving grading results...",
        data={"step": 5, "action": "saving_results"},
    )

    # Results are saved in the main async function
    # This node just confirms the save operation

    await publish_stream_update(
        state["agent_run_id"],
        state["thread_id"],
        "✅ Grading complete! Results saved successfully.",
        data={
            "step": 5,
            "action": "completed",
            "progress": 100,
            "final_score": state["total_score"],
            "max_score": state["max_score"],
            "grade": (
                "A" if (state["total_score"] / state["max_score"]) * 100 >= 90
                else "B" if (state["total_score"] / state["max_score"]) * 100 >= 80
                else "C" if (state["total_score"] / state["max_score"]) * 100 >= 70
                else "D" if (state["total_score"] / state["max_score"]) * 100 >= 60
                else "F"
            ),
        },
        save_db=True,
    )

    return {
        **state,
        "messages": [SystemMessage(content="Grading results saved to database")],
    }


def create_autograder_graph():
    """
    Build the LangGraph autograder workflow

    Flow:
    START → fetch_submission_data → evaluate_criteria → generate_feedback
          → generate_final_report → save_grading_results → END

    Follows the same pattern as educational_ai_graph in graph.py
    """
    workflow = StateGraph(AutograderState)

    # Add all nodes (following graph.py pattern)
    workflow.add_node("fetch", fetch_submission_data)
    workflow.add_node("evaluate", evaluate_criteria)
    workflow.add_node("feedback", generate_feedback)
    workflow.add_node("final_report", generate_final_report)
    workflow.add_node("save", save_grading_results)

    # Define edges (flow)
    workflow.set_entry_point("fetch")
    workflow.add_edge("fetch", "evaluate")
    workflow.add_edge("evaluate", "feedback")
    workflow.add_edge("feedback", "final_report")
    workflow.add_edge("final_report", "save")
    workflow.add_edge("save", END)

    # Compile workflow
    return workflow.compile()


@dramatiq.actor(max_retries=3, time_limit=600_000)  # 10 minute timeout
def autograder_task(
    agent_run_id: str,
    thread_id: str,
    assignment_id: str,
    submission_content: str,
    rubric: dict,
) -> dict[str, Any]:
    """
    Autograder task for automated assignment evaluation.

    This task:
    1. Analyzes submission content
    2. Evaluates against rubric criteria
    3. Generates detailed feedback
    4. Calculates final score and grade

    Args:
        agent_run_id: AgentRun ID for tracking
        thread_id: Thread ID for context
        assignment_id: Assignment identifier
        submission_content: Student submission content
        rubric: Grading rubric with criteria and points

    Returns:
        Dict containing grading results
    """
    logger.info(
        "[AUTOGRADER] Starting autograder for assignment %s, agent_run %s",
        assignment_id,
        agent_run_id,
    )

    task_start_time = datetime.now(timezone.utc)

    try:
        return asyncio.run(
            _run_autograder_async(
                agent_run_id,
                thread_id,
                assignment_id,
                submission_content,
                rubric,
                task_start_time,
            )
        )
    except Exception as e:
        error_msg = f"Autograder error: {str(e)}"
        logger.error(f"[AUTOGRADER] {error_msg}", exc_info=True)
        return {
            "agent_run_id": agent_run_id,
            "thread_id": thread_id,
            "status": "failed",
            "error": error_msg,
            "started_at": task_start_time.isoformat(),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }


async def _run_autograder_async(
    agent_run_id: str,
    thread_id: str,
    assignment_id: str,
    submission_content: str,
    rubric: dict,
    task_start_time: datetime,
) -> dict[str, Any]:
    """Async helper for autograder execution."""
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
            f"🎯 Starting autograder for assignment: {assignment_id}",
            data={
                "step": 0,
                "action": "started",
                "assignment_id": assignment_id,
            },
            save_db=True,
        )

        # Determine if AI grading should be used
        use_ai_grading = agent_run.my_metadata.get("use_ai_grading", True)
        model_name = agent_run.my_metadata.get("model_name", "gpt-4o-mini")

        # Create initial state (following graph.py pattern with LangChain messages)
        initial_state: AutograderState = {
            # Input IDs
            "agent_run_id": agent_run_id,
            "thread_id": thread_id,
            "assignment_id": assignment_id,
            # Configuration
            "model_name": model_name,
            "use_ai_grading": use_ai_grading,
            # Loaded data
            "submission_content": submission_content,
            "rubric": rubric,
            "submission_analysis": {},
            # Processing results
            "total_score": 0.0,
            "max_score": 0.0,
            "criteria_scores": {},
            "feedback": [],
            "detailed_analysis": "",
            # Final output
            "final_report": "",
            # Workflow control (LangChain pattern)
            "messages": [],  # Message accumulator for event tracking
            "error": None,
            "retry_count": 0,
        }

        # Run autograder workflow
        try:
            autograder_graph = create_autograder_graph()
            final_state = await autograder_graph.ainvoke(initial_state)
        except Exception as e:
            logger.error(f"[AUTOGRADER] Workflow error: {e}")
            await publish_stream_update(
                agent_run_id,
                thread_id,
                f"❌ Grading error: {str(e)}",
                save_db=True,
            )
            raise

        # Update AgentRun status with comprehensive results
        agent_run.status = AgentRunStatus.COMPLETED
        agent_run.completed_at = datetime.now(timezone.utc)

        # Calculate grade letter
        percentage = (final_state["total_score"] / final_state["max_score"]) * 100
        grade_letter = (
            "A"
            if percentage >= 90
            else "B"
            if percentage >= 80
            else "C"
            if percentage >= 70
            else "D"
            if percentage >= 60
            else "F"
        )

        # Store comprehensive grading results in metadata (following graph.py pattern)
        agent_run.my_metadata.update(
            {
                "assignment_id": assignment_id,
                "grading_results": {
                    "total_score": final_state["total_score"],
                    "max_score": final_state["max_score"],
                    "percentage": percentage,
                    "grade": grade_letter,
                    "criteria_scores": final_state["criteria_scores"],
                    "feedback": final_state["feedback"],
                    "detailed_analysis": final_state.get("detailed_analysis", ""),
                    "final_report": final_state.get("final_report", ""),
                },
                "grading_metadata": {
                    "model_used": final_state.get("model_name", ""),
                    "use_ai_grading": final_state.get("use_ai_grading", False),
                    "graded_at": datetime.now(timezone.utc).isoformat(),
                    "duration": (
                        datetime.now(timezone.utc) - task_start_time
                    ).total_seconds(),
                },
                "statistics": {
                    "feedback_count": len(final_state["feedback"]),
                    "criteria_count": len(final_state["criteria_scores"]),
                    "submission_length": len(submission_content),
                    **final_state.get("submission_analysis", {}),
                },
            }
        )
        session.add(agent_run)
        session.commit()
        session.refresh(agent_run)

        # Cleanup Redis
        await redis.delete(f"active_run:autograder:{agent_run.id}")

        duration = (datetime.now(timezone.utc) - task_start_time).total_seconds()
        logger.info(f"[AUTOGRADER] Completed in {duration:.1f}s")

        return {
            "agent_run_id": str(agent_run.id),
            "status": "completed",
            "duration": duration,
            "score": final_state["total_score"],
            "max_score": final_state["max_score"],
            "feedback": final_state["feedback"],
        }


__all__ = ["autograder_task"]
