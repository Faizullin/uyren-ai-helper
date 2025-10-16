"""
Grading Processor
High-level interface for starting and managing grading workflows
"""

import asyncio
from datetime import datetime, timezone
from uuid import UUID

from app.core.db import get_db
from app.core.logger import logger

from .graph import GradingState, grading_graph
from .models import Assignment, GradingSession
from .thirdparty import create_client


class GradingProcessor:
    """
    High-level processor for grading workflows
    Handles batch processing and workflow orchestration
    """

    @staticmethod
    async def start_grading(
        assignment_id: UUID,
        submission_data: dict | None = None,
        owner_id: UUID | None = None,
    ) -> str:
        """
        Start grading for a single submission

        Args:
            assignment_id: Which assignment to grade
            submission_data: Optional pre-loaded submission data (or will fetch from API)
            owner_id: Account ID for the grading session

        Returns:
            session_id: ID of created grading session for tracking
        """
        logger.info(f"[PROCESSOR] Starting grading for assignment {assignment_id}")

        async with get_db() as session:
            # Load assignment
            assignment = await session.get(Assignment, assignment_id)
            if not assignment:
                raise ValueError(f"Assignment {assignment_id} not found")

            # Create grading session
            grading_session = GradingSession(
                assignment_id=assignment_id,
                owner_id=owner_id or assignment.owner_id,
                thirdparty_data=submission_data or {},
                status="pending",
            )

            session.add(grading_session)
            await session.commit()
            await session.refresh(grading_session)

            session_id = str(grading_session.id)
            logger.info(f"[PROCESSOR] Created session {session_id}")

        # Start workflow in background
        asyncio.create_task(
            GradingProcessor._run_workflow(session_id, str(assignment_id))
        )

        return session_id

    @staticmethod
    async def start_batch_grading(assignment_id: UUID) -> list[str]:
        """
        Fetch all submissions from third-party API and start grading for each

        This is the main entry point for bulk grading:
        1. Calls third-party API to get all submissions (paginated)
        2. Creates a GradingSession for each submission
        3. Starts grading workflow for each (in parallel chunks)

        Args:
            assignment_id: Which assignment to grade

        Returns:
            List of session IDs created
        """
        logger.info(
            f"[PROCESSOR] Starting batch grading for assignment {assignment_id}"
        )

        async with get_db() as session:
            # Load assignment configuration
            assignment = await session.get(Assignment, assignment_id)
            if not assignment:
                raise ValueError(f"Assignment {assignment_id} not found")

            # Get pagination settings
            page_size = assignment.settings.get("fetch_pagination", {}).get(
                "page_size", 50
            )

            # Get API key if configured
            api_key = None
            if assignment.api_key_id:
                from app.models.api_key import APIKey

                api_key_obj = await session.get(APIKey, assignment.api_key_id)
                if api_key_obj:
                    api_key = (
                        api_key_obj.public_key
                    )  # Use public key for third-party auth

            # Fetch all submissions from third-party API (paginated)
            logger.info(
                "[PROCESSOR] Fetching submissions from third-party API (paginated)"
            )
            client = create_client(assignment.thirdparty_api_url, api_key)

            submissions = await client.fetch_all_submissions(
                assignment.thirdparty_assignment_id, page_size=page_size
            )
            logger.info(f"[PROCESSOR] Fetched {len(submissions)} submissions")

            # Create grading sessions for each submission
            session_ids = []
            for submission in submissions:
                grading_session = GradingSession(
                    assignment_id=assignment_id,
                    owner_id=assignment.owner_id,
                    thirdparty_data=submission,  # Store raw third-party data
                    status="pending",
                )

                session.add(grading_session)
                await session.flush()  # Get ID without committing
                session_ids.append(str(grading_session.id))

            await session.commit()
            logger.info(f"[PROCESSOR] Created {len(session_ids)} grading sessions")

        # Start workflows in parallel chunks (50 at a time to avoid overwhelming)
        chunk_size = 50
        for i in range(0, len(session_ids), chunk_size):
            chunk = session_ids[i : i + chunk_size]
            tasks = [
                GradingProcessor._run_workflow(session_id, str(assignment_id))
                for session_id in chunk
            ]
            # Run chunk in background
            asyncio.create_task(asyncio.gather(*tasks, return_exceptions=True))

        return session_ids

    @staticmethod
    async def _run_workflow(session_id: str, assignment_id: str) -> None:
        """
        Execute the LangGraph workflow for a single submission

        This method:
        1. Initializes the state
        2. Runs the graph (fetch → analyze → grade → save)
        3. Handles errors and retries
        4. Updates progress in database

        Runs in background, can be interrupted and resumed
        """
        logger.info(f"[WORKFLOW] Starting for session {session_id}")

        # Update status to processing
        async with get_db() as session:
            grading_session = await session.get(GradingSession, session_id)
            if grading_session:
                grading_session.status = "processing"
                grading_session.started_at = datetime.now(timezone.utc)
                grading_session.current_step = "fetch"
                await session.commit()

        # Initial state
        initial_state = GradingState(
            session_id=session_id,
            assignment_id=assignment_id,
            assignment={},
            thirdparty_data={},
            rag_context=None,
            analysis={},
            grade_breakdown={},
            total_grade=0.0,
            feedback="",
            messages=[("system", "Starting grading workflow")],
            error=None,
            retry_count=0,
        )

        # Configuration for checkpointing
        # thread_id allows resuming this specific workflow
        config = {
            "configurable": {
                "thread_id": f"grading_{session_id}",
                "checkpoint_ns": "grading",
            }
        }

        try:
            # Execute workflow
            # This runs through: fetch → retrieve → analyze → grade → feedback → save
            logger.info(f"[WORKFLOW] Executing graph for session {session_id}")
            final_state = await grading_graph.ainvoke(initial_state, config)

            # Check for errors
            if final_state.get("error"):
                logger.error(f"[WORKFLOW] Error: {final_state['error']}")
                raise Exception(final_state["error"])

            logger.info(f"[WORKFLOW] Complete! Grade: {final_state['total_grade']}")

        except Exception as e:
            logger.error(f"[WORKFLOW] Failed: {str(e)}")

            # Mark as failed in database
            async with get_db() as session:
                grading_session = await session.get(GradingSession, session_id)
                if grading_session:
                    grading_session.status = "failed"
                    grading_session.error = str(e)
                    grading_session.completed_at = datetime.now(timezone.utc)
                    await session.commit()

    @staticmethod
    async def get_status(session_id: UUID) -> dict:
        """
        Get current grading status

        Returns information about:
        - Current workflow step
        - Progress percentage
        - Grade (if completed)
        - Error (if failed)

        Args:
            session_id: Grading session ID

        Returns:
            Status dictionary
        """
        async with get_db() as session:
            grading_session = await session.get(GradingSession, session_id)
            if not grading_session:
                return {"error": "Session not found"}

            status = {
                "session_id": str(grading_session.id),
                "status": grading_session.status,
                "current_step": grading_session.current_step,
                "progress": grading_session.progress,
                "error": grading_session.error,
            }

            # Add results if completed
            if grading_session.status == "graded" and grading_session.results:
                status["grade"] = grading_session.results.get("grade")
                status["feedback"] = grading_session.results.get("feedback")

            return status

    @staticmethod
    async def approve_grade(
        session_id: UUID, approved: bool, adjusted_grade: float | None = None
    ) -> dict:
        """
        Teacher reviews and approves/adjusts a grade

        Resumes the workflow from the 'review' node with updated values

        Args:
            session_id: Grading session to review
            approved: Whether to approve as-is
            adjusted_grade: Optional adjusted score

        Returns:
            Updated status
        """
        logger.info(f"[PROCESSOR] Teacher review for session {session_id}")

        async with get_db() as session:
            grading_session = await session.get(GradingSession, session_id)
            if not grading_session:
                raise ValueError("Session not found")

            # Get current workflow state
            config = {"configurable": {"thread_id": f"grading_{session_id}"}}
            current_state = await grading_graph.aget_state(config)

            # Apply adjustments
            if adjusted_grade is not None:
                current_state.values["total_grade"] = adjusted_grade

            # Add review message
            current_state.values["messages"].append(
                ("human", f"Reviewed: {'Approved' if approved else 'Adjusted'}")
            )

            # Resume from review node
            await grading_graph.aupdate_state(
                config, current_state.values, as_node="review"
            )

            logger.info(
                f"[PROCESSOR] Review complete, final grade: {current_state.values['total_grade']}"
            )

            return await GradingProcessor.get_status(session_id)
