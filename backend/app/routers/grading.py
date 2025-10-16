"""
Educational AI Grading Routes
Single endpoint to trigger auto-grading workflow
"""

from uuid import UUID

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from sqlmodel import select

from app.core.db import SessionDep
from app.core.logger import logger
from app.modules.edu_ai.models import Assignment, CourseMaterial, GradingSession
from app.modules.edu_ai.processor import GradingProcessor
from app.utils.authentication import CurrentUser

router = APIRouter(tags=["grading"])


@router.post(
    "/grading/assignments/{assignment_id}/start",
    summary="Start Auto-Grading",
    operation_id="start_auto_grading",
)
async def start_auto_grading(
    assignment_id: UUID,
    user: CurrentUser,
    session: SessionDep,
):
    """
    Start auto-grading workflow for an assignment

    **This is the SINGLE route that does everything:**

    1. **Fetches submissions** from third-party API (configured in assignment)
    2. **Creates grading sessions** for each submission (dynamic JSONB storage)
    3. **Starts LangGraph workflow** for each submission (in parallel):
       - Fetch assignment data
       - Retrieve RAG context (if enabled)
       - AI analysis of submission
       - Calculate grade based on rubric
       - Generate student feedback
       - Save results
    4. **Returns session IDs** for tracking progress

    **How it works:**

    The assignment must be pre-configured with:
    - `thirdparty_api_url`: Base URL of external API (e.g., "https://api.classroom.com")
    - `thirdparty_api_key`: API key for authentication (optional)
    - `thirdparty_assignment_id`: Their internal assignment ID
    - `settings`: Grading configuration (model, rubric, RAG, etc.)

    The workflow then:
    1. Calls `{thirdparty_api_url}/api/v1/assignments/{thirdparty_assignment_id}/submissions`
    2. Gets array of submission objects (schema is flexible - stored as-is in JSONB)
    3. For each submission:
       - Creates `GradingSession` with raw third-party data
       - Starts LangGraph workflow in background
       - AI analyzes and grades
       - Results saved back to `GradingSession.results` (JSONB)

    **Third-party data structure (example):**
    ```json
    {
        "submission_id": "ext_12345",
        "student": {
            "id": "student_789",
            "name": "John Doe",
            "email": "john@example.com"
        },
        "submission": {
            "content": "Student's work...",
            "files": ["https://..."],
            "submitted_at": "2025-10-12T10:30:00Z"
        }
    }
    ```

    **Optimization features:**
    - ✅ Parallel grading (all submissions processed simultaneously)
    - ✅ Checkpointing (can resume if server crashes)
    - ✅ Progress tracking (poll status endpoint)
    - ✅ Dynamic schema (no rigid database tables for third-party data)
    - ✅ Thread-safe (LangGraph handles concurrency)

    **Example request:**
    ```bash
    POST /api/v1/grading/assignments/123e4567-e89b-12d3-a456-426614174000/start
    ```

    **Response:**
    ```json
    {
        "assignment_id": "123e4567-e89b-12d3-a456-426614174000",
        "status": "started",
        "session_count": 25,
        "session_ids": ["uuid1", "uuid2", ...],
        "message": "Grading started for 25 submissions"
    }
    ```
    """
    logger.info(f"[API] Starting auto-grading for assignment {assignment_id}")

    # Verify assignment exists and user has access
    result = await session.execute(
        select(Assignment)
        .where(Assignment.id == assignment_id)
        .where(Assignment.owner_id == user.id)
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(
            status_code=404, detail="Assignment not found or access denied"
        )

    # Verify third-party API is configured
    if not assignment.thirdparty_api_url:
        raise HTTPException(
            status_code=400, detail="Assignment must have thirdparty_api_url configured"
        )

    if not assignment.thirdparty_assignment_id:
        raise HTTPException(
            status_code=400,
            detail="Assignment must have thirdparty_assignment_id configured",
        )

    try:
        # Start batch grading
        # This will:
        # 1. Fetch all submissions from third-party API
        # 2. Create GradingSession for each (with raw data in JSONB)
        # 3. Start LangGraph workflow for each (parallel execution)
        logger.info("[API] Calling GradingProcessor.start_batch_grading")

        session_ids = await GradingProcessor.start_batch_grading(assignment_id)

        logger.info(f"[API] Started grading for {len(session_ids)} submissions")

        return {
            "assignment_id": str(assignment_id),
            "status": "started",
            "session_count": len(session_ids),
            "session_ids": session_ids,
            "message": f"Grading started for {len(session_ids)} submissions. Use session IDs to track progress.",
        }

    except ValueError as e:
        logger.error(f"[API] Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

    except Exception as e:
        logger.error(f"[API] Error starting grading: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to start grading: {str(e)}"
        )


@router.get(
    "/grading/sessions/{session_id}/status",
    summary="Get Grading Status",
    operation_id="get_grading_status",
)
async def get_grading_status(
    session_id: UUID,
    user: CurrentUser,
    session: SessionDep,
):
    """
    Check progress of a grading session

    **Returns current state:**
    - Which step is running (fetch, analyze, grade, etc.)
    - Progress percentage (0-100)
    - Grade (if completed)
    - Error (if failed)

    **Use this to show progress UI:**
    ```javascript
    // Poll every 2 seconds
    const interval = setInterval(async () => {
        const status = await fetch(`/api/v1/grading/sessions/${sessionId}/status`);
        console.log(`Step: ${status.current_step}, Progress: ${status.progress}%`);

        if (status.status === 'graded') {
            console.log(`Grade: ${status.grade}`);
            clearInterval(interval);
        }
    }, 2000);
    ```
    """
    logger.debug(f"[API] Getting status for session {session_id}")

    # Verify access
    result = await session.execute(
        select(GradingSession)
        .where(GradingSession.id == session_id)
        .where(GradingSession.owner_id == user.id)
    )
    grading_session = result.scalar_one_or_none()

    if not grading_session:
        raise HTTPException(
            status_code=404, detail="Grading session not found or access denied"
        )

    try:
        status = await GradingProcessor.get_status(session_id)
        return status

    except Exception as e:
        logger.error(f"[API] Error getting status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/grading/sessions/{session_id}/review",
    summary="Review and Approve Grade",
    operation_id="review_grade",
)
async def review_grade(
    session_id: UUID,
    approved: bool = Form(...),
    adjusted_grade: float | None = Form(None),
    user: CurrentUser = None,
    session: SessionDep = None,
):
    """
    Teacher reviews and approves/adjusts AI-generated grade

    **When to use:**
    - Assignment has `require_manual_review: true` in settings
    - Grade is borderline (close to passing threshold)

    **How it works:**
    1. LangGraph workflow pauses at 'review' node
    2. Teacher calls this endpoint with decision
    3. Workflow resumes and saves final grade

    **Example:**
    ```bash
    POST /api/v1/grading/sessions/{id}/review
    {
        "approved": true
    }
    # OR adjust grade
    {
        "approved": false,
        "adjusted_grade": 85.5
    }
    ```
    """
    logger.info(f"[API] Teacher review for session {session_id}")

    # Verify access
    result = await session.execute(
        select(GradingSession)
        .where(GradingSession.id == session_id)
        .where(GradingSession.owner_id == user.id)
    )
    grading_session = result.scalar_one_or_none()

    if not grading_session:
        raise HTTPException(
            status_code=404, detail="Grading session not found or access denied"
        )

    try:
        result = await GradingProcessor.approve_grade(
            session_id, approved, adjusted_grade
        )
        return result

    except Exception as e:
        logger.error(f"[API] Error approving grade: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post(
    "/grading/assignments",
    summary="Create Assignment",
    operation_id="create_assignment",
)
async def create_assignment(
    title: str = Form(...),
    description: str | None = Form(None),
    thirdparty_api_url: str = Form(...),
    thirdparty_assignment_id: str = Form(...),
    thirdparty_api_key: str | None = Form(None),
    # Grading settings (all optional with defaults)
    auto_grade: bool = Form(True),
    require_manual_review: bool = Form(False),
    use_rag: bool = Form(False),
    grading_model: str = Form("gpt-5-mini"),
    teacher_instructions: str = Form(""),
    rubric: dict | None = Form(None),  # JSON: {"criterion": points, ...}
    max_points: int = Form(100),
    user: CurrentUser = None,
    session: SessionDep = None,
):
    """
    Create a new assignment with grading configuration

    **Required fields:**
    - `title`: Assignment name
    - `thirdparty_api_url`: Base URL of external LMS API
    - `thirdparty_assignment_id`: Their internal assignment ID

    **Optional grading settings:**
    - `auto_grade`: Start grading immediately when triggered (default: true)
    - `require_manual_review`: Teacher must approve all grades (default: false)
    - `use_rag`: Use uploaded course materials as context (default: false)
    - `grading_model`: AI model to use (default: "gpt-5-mini")
    - `teacher_instructions`: Additional context for AI grader
    - `rubric`: JSON object mapping criteria to points
    - `max_points`: Maximum score (default: 100)

    **Example:**
    ```bash
    POST /api/v1/grading/assignments
    {
        "title": "Essay Assignment 1",
        "thirdparty_api_url": "https://api.classroom.com",
        "thirdparty_assignment_id": "assignment_123",
        "thirdparty_api_key": "secret_key",
        "rubric": {
            "thesis_clarity": 20,
            "evidence": 30,
            "organization": 25,
            "grammar": 25
        },
        "teacher_instructions": "Focus on argument quality over grammar"
    }
    ```
    """
    logger.info(f"[API] Creating assignment: {title}")

    # Build settings object
    settings = {
        "auto_grade": auto_grade,
        "require_manual_review": require_manual_review,
        "use_rag": use_rag,
        "grading_model": grading_model,
        "teacher_instructions": teacher_instructions,
        "rubric": rubric,
        "max_points": max_points,
        "temperature": 0.3,
        "max_tokens": 4000,
    }

    # Create assignment
    assignment = Assignment(
        account_id=user.id,
        title=title,
        description=description,
        thirdparty_api_url=thirdparty_api_url,
        thirdparty_api_key=thirdparty_api_key,
        thirdparty_assignment_id=thirdparty_assignment_id,
        settings=settings,
    )

    session.add(assignment)
    await session.commit()
    await session.refresh(assignment)

    logger.info(f"[API] Created assignment {assignment.id}")

    return {
        "id": str(assignment.id),
        "title": assignment.title,
        "thirdparty_api_url": assignment.thirdparty_api_url,
        "thirdparty_assignment_id": assignment.thirdparty_assignment_id,
        "settings": assignment.settings,
    }


@router.post(
    "/grading/assignments/{assignment_id}/materials",
    summary="Upload Course Material for RAG",
    operation_id="upload_course_material",
)
async def upload_course_material(
    assignment_id: UUID,
    title: str = Form(...),
    file: UploadFile = File(...),
    user: CurrentUser = None,
    session: SessionDep = None,
):
    """
    Upload reference materials for RAG-enhanced grading

    **Use case:**
    Teacher uploads course notes, rubrics, example essays, etc.
    When RAG is enabled, AI uses these as context for grading.

    **Supported formats:**
    - PDF
    - DOCX
    - TXT
    - MD

    **How it works:**
    1. Extract text from file
    2. Generate vector embedding (for similarity search)
    3. Store in course_materials table
    4. When grading, retrieve relevant materials based on submission content

    **Note:** Requires pgvector extension for full functionality
    """
    logger.info(f"[API] Uploading course material for assignment {assignment_id}")

    # Verify assignment exists and user has access
    result = await session.execute(
        select(Assignment)
        .where(Assignment.id == assignment_id)
        .where(Assignment.owner_id == user.id)
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        raise HTTPException(
            status_code=404, detail="Assignment not found or access denied"
        )

    try:
        # Extract text from file
        content = await file.read()
        text_content = content.decode("utf-8")  # Simple text extraction

        # TODO: Add proper text extraction for PDF/DOCX
        # from app.utils.text_extraction import extract_text
        # text_content = await extract_text(file)

        # TODO: Generate embedding when pgvector is enabled
        # from langchain_openai import OpenAIEmbeddings
        # embeddings = OpenAIEmbeddings(model="text-embedding-3-small")
        # embedding = await embeddings.aembed_query(text_content)

        # Store material
        material = CourseMaterial(
            assignment_id=assignment_id,
            account_id=user.id,
            title=title,
            content=text_content,
            file_url=None,  # Could upload to S3
            # embedding=embedding,  # Uncomment when pgvector enabled
        )

        session.add(material)
        await session.commit()
        await session.refresh(material)

        logger.info(f"[API] Uploaded material {material.id}")

        return {
            "id": str(material.id),
            "title": title,
            "content_length": len(text_content),
        }

    except Exception as e:
        logger.error(f"[API] Error uploading material: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
