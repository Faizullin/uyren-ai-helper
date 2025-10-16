# Educational AI Grading Module

Complete auto-grading system with LangGraph workflow orchestration.

## 📁 Module Structure

```
app/modules/edu_ai/
├── __init__.py           # Exports: Assignment, GradingSession, CourseMaterial, GradingProcessor, grading_graph
├── models.py             # Database models (dynamic JSONB schema)
├── graph.py              # LangGraph workflow (6 nodes: fetch → retrieve → analyze → grade → feedback → save)
├── processor.py          # High-level API (start_grading, start_batch_grading, get_status, approve_grade)
├── thirdparty.py         # Third-party API client (fetch submissions from external LMS)
└── README.md             # This file
```

## 🎯 Core Concept

**Single dynamic table** (`GradingSession`) stores ALL third-party submission data as JSONB. No rigid schema assumptions.

### Database Models

#### `Assignment`
Assignment configuration with grading settings.

```python
{
    "id": UUID,
    "account_id": UUID,
    "title": "Essay Assignment 1",
    "thirdparty_api_url": "https://api.classroom.com",
    "thirdparty_assignment_id": "assignment_123",
    "settings": {
        "auto_grade": true,
        "require_manual_review": false,
        "use_rag": false,
        "grading_model": "gpt-5-mini",
        "teacher_instructions": "Focus on argument quality",
        "rubric": {
            "thesis_clarity": 20,
            "evidence": 30,
            "organization": 25,
            "grammar": 25
        },
        "max_points": 100
    }
}
```

#### `GradingSession`
Single unified table for submission data + grading results.

```python
{
    "id": UUID,
    "assignment_id": UUID,
    "status": "pending",  # pending → processing → graded
    
    # Raw third-party data (flexible schema)
    "thirdparty_data": {
        "submission_id": "ext_12345",
        "student": {
            "id": "student_789",
            "name": "John Doe",
            "email": "john@example.com"
        },
        "submission": {
            "content": "Student's essay...",
            "files": ["https://..."],
            "submitted_at": "2025-10-12T10:30:00Z"
        }
    },
    
    # Grading results (also JSONB)
    "results": {
        "grade": 85.5,
        "max_points": 100,
        "feedback": "Great work!...",
        "rubric_scores": {
            "thesis_clarity": {"score": 18, "max": 20, "reason": "..."}
        },
        "model_used": "gpt-5-mini",
        "graded_at": "2025-10-12T11:00:00Z"
    }
}
```

#### `CourseMaterial`
Reference materials for RAG-enhanced grading.

## 🔄 LangGraph Workflow

### Flow Diagram

```
START
  ↓
[fetch_assignment_data]  ← Load assignment config + fetch from third-party API
  ↓
[retrieve_rag_context]   ← (Optional) Search course materials for context
  ↓
[analyze_submission]     ← AI qualitative analysis (strengths/weaknesses)
  ↓
[calculate_grade]        ← AI numerical grading (rubric-based or holistic)
  ↓
[generate_feedback]      ← Format student-facing feedback
  ↓
[review?]                ← Conditional: pause for human review if needed
  ↓
[save_results]           ← Save to database + notify student
  ↓
END
```

### State Flow

Each node reads from and writes to `GradingState`:

```python
class GradingState(TypedDict):
    session_id: str
    assignment_id: str
    assignment: dict              # Loaded from DB
    thirdparty_data: dict         # Fetched from external API
    rag_context: str | None       # Retrieved course materials
    analysis: dict                # AI qualitative analysis
    grade_breakdown: dict         # Per-criterion scores
    total_grade: float            # Final grade
    feedback: str                 # Student-facing feedback
    messages: list[BaseMessage]   # Event log
    error: str | None
    retry_count: int
```

### Key Features

✅ **Checkpointing**: Workflow state persists to PostgreSQL (can resume after crashes)  
✅ **Thread-safe**: LangGraph handles concurrent grading  
✅ **Retry logic**: Automatic retries on API failures  
✅ **Human-in-the-loop**: Pauses at `review` node for teacher approval  
✅ **Progress tracking**: Poll current step and progress percentage  

## 🚀 Usage

### 1. Create Assignment

```python
POST /api/v1/grading/assignments
{
    "title": "Essay Assignment 1",
    "thirdparty_api_url": "https://api.classroom.com",
    "thirdparty_assignment_id": "assignment_123",
    "rubric": {
        "thesis_clarity": 20,
        "evidence": 30
    },
    "grading_model": "gpt-5-mini"
}
```

### 2. Start Auto-Grading

```python
POST /api/v1/grading/assignments/{assignment_id}/start
```

**What happens:**
1. Calls `{thirdparty_api_url}/api/v1/assignments/{assignment_id}/submissions`
2. Gets array of submission objects
3. Creates `GradingSession` for each (stores raw data in JSONB)
4. Starts LangGraph workflow for each (parallel execution)
5. Returns session IDs for tracking

### 3. Track Progress

```python
GET /api/v1/grading/sessions/{session_id}/status

Response:
{
    "status": "processing",
    "current_step": "analyze",
    "progress": 60,
    "grade": null  # Available when completed
}
```

### 4. Review Grade (if needed)

```python
POST /api/v1/grading/sessions/{session_id}/review
{
    "approved": false,
    "adjusted_grade": 85.5
}
```

## 🔌 Third-Party Integration

### API Requirements

Your external LMS API must provide:

```
GET {thirdparty_api_url}/api/v1/assignments/{assignment_id}/submissions

Response:
[
    {
        "submission_id": "ext_12345",
        "student": {
            "id": "student_789",
            "name": "John Doe",
            "email": "john@example.com"
        },
        "submission": {
            "content": "Student work...",
            "files": ["https://..."],
            "submitted_at": "2025-10-12T10:30:00Z"
        }
    }
]
```

**Note**: Schema is flexible - any structure is stored as-is in `thirdparty_data` JSONB field.

### Authentication

Set `thirdparty_api_key` in assignment config. The client sends:

```
Authorization: Bearer {thirdparty_api_key}
```

## 🧠 AI Model Selection

Uses your existing `ModelManager` from `app/modules/ai_models/`.

Supports:
- Model aliases (e.g., "gpt-5" → actual model ID)
- Tier-based access (free/paid models)
- Cost calculation
- Fallback mechanisms

## 📊 RAG (Optional)

Enable in assignment settings:

```python
{
    "use_rag": true
}
```

Upload course materials:

```python
POST /api/v1/grading/assignments/{id}/materials
- title: "Course Notes Chapter 3"
- file: notes.pdf
```

When grading:
1. Extract key terms from submission
2. Vector search course materials (requires pgvector)
3. Include top 3 similar materials as context for AI

## ⚡ Optimization Features

### Parallel Processing

All submissions graded simultaneously:

```python
# 100 submissions = 100 concurrent LangGraph workflows
session_ids = await GradingProcessor.start_batch_grading(assignment_id)
```

### Checkpointing

Server crashes mid-grading? No problem:

```python
# Workflow resumes from last checkpoint
config = {
    "configurable": {
        "thread_id": f"grading_{session_id}"
    }
}
await grading_graph.ainvoke(state, config)
```

### Progress Tracking

Real-time updates:

```javascript
// Frontend polling
setInterval(async () => {
    const status = await fetch(`/api/v1/grading/sessions/${id}/status`);
    console.log(`Step: ${status.current_step}, Progress: ${status.progress}%`);
}, 2000);
```

## 🛠️ Development

### Install Dependencies

```bash
uv sync
# Installs: langgraph, langgraph-checkpoint-postgres, langchain-core, langchain-openai
```

### Run Migrations

```bash
alembic revision --autogenerate -m "add_edu_ai_tables"
alembic upgrade head
```

### Test Third-Party API

```python
from app.modules.edu_ai.thirdparty import create_client

client = create_client("https://api.classroom.com", "api_key")
submissions = await client.fetch_submissions("assignment_123")
print(f"Found {len(submissions)} submissions")
```

### Test Workflow

```python
from app.modules.edu_ai import GradingProcessor

session_id = await GradingProcessor.start_grading(
    assignment_id=UUID("..."),
    submission_data={"content": "Test submission"}
)

# Check status
status = await GradingProcessor.get_status(session_id)
```

## 📝 TODOs

- [ ] Implement pgvector for RAG similarity search
- [ ] Add PDF/DOCX text extraction for course materials
- [ ] Add student notification system
- [ ] Add grade export (CSV, Excel)
- [ ] Add analytics dashboard (grade distribution, avg time, etc.)
- [ ] Add support for code execution (if grading code assignments)

## 🔧 Configuration

### Environment Variables

```bash
# In .env or settings
OPENAI_API_KEY=sk-...          # For AI grading
DATABASE_URL=postgresql://...   # For checkpointing
LOG_LEVEL=INFO                 # Logging
```

### Assignment Settings

All settings in `Assignment.settings` JSONB:

```python
{
    "auto_grade": true,              # Grade immediately on submission
    "require_manual_review": false,  # Teacher must approve all grades
    "use_rag": false,                # Use course materials as context
    "grading_model": "gpt-5-mini",   # AI model (supports aliases)
    "teacher_instructions": "",      # Additional context for AI
    "rubric": {},                    # Criterion → points mapping
    "max_points": 100,               # Maximum score
    "temperature": 0.3,              # AI creativity (0-1)
    "max_tokens": 4000               # AI response length
}
```

## 🎓 Example: Complete Flow

```python
# 1. Teacher creates assignment
assignment = await create_assignment(
    title="Essay: Climate Change",
    thirdparty_api_url="https://api.classroom.com",
    thirdparty_assignment_id="essay_001",
    rubric={
        "thesis": 20,
        "evidence": 30,
        "organization": 25,
        "grammar": 25
    }
)

# 2. Teacher uploads reference materials (optional)
await upload_course_material(
    assignment_id=assignment.id,
    title="Lecture Notes: Climate Science",
    file=lecture_notes_pdf
)

# 3. Teacher triggers grading (fetches from third-party API)
result = await start_auto_grading(assignment.id)
# Returns: {"session_count": 25, "session_ids": [...]}

# 4. Students see progress in real-time
status = await get_grading_status(session_ids[0])
# Returns: {"status": "processing", "current_step": "analyze", "progress": 60}

# 5. AI completes grading
final_status = await get_grading_status(session_ids[0])
# Returns: {"status": "graded", "grade": 85.5, "feedback": "Great work!..."}

# 6. Teacher reviews borderline grades (if needed)
await review_grade(
    session_id=session_ids[0],
    approved=False,
    adjusted_grade=87.0
)
```

## 📚 References

- LangGraph Docs: https://langchain-ai.github.io/langgraph/
- PostgreSQL Checkpointer: https://github.com/langchain-ai/langgraph/tree/main/libs/checkpoint-postgres
- Model Manager: `app/modules/ai_models/`

---

**Built with**: FastAPI, LangGraph, PostgreSQL, OpenAI/Anthropic

