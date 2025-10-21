# Backend Development Guide

Quick reference for backend architecture patterns and conventions.

## Project Structure

```
backend/app/
├── api/main.py              # API router registry
├── core/                    # Core configurations
│   ├── config.py           # Settings (from .env)
│   ├── db.py               # Database session
│   ├── logger.py           # Logging
│   └── security.py         # Auth utilities
├── models/                  # SQLModel ORM models
├── schemas/                 # Pydantic request/response models
├── routers/                 # FastAPI route handlers
├── services/                # Business logic layer
├── crud/                    # Database operations
├── modules/                 # Feature modules
└── utils/                   # Utility functions
```

## Core Patterns

### 1. Database Models (SQLModel)

```python
from sqlmodel import Field, SQLModel
from datetime import datetime, timezone
import uuid

class MyModel(SQLModel, table=True):
    """Database ORM model for my_table."""
    
    __tablename__ = "my_table"
    
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", ondelete="CASCADE")
    name: str = Field(max_length=255)
    description: str | None = Field(default=None, sa_column=Column(Text))
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (Index("ix_my_table_user_id", "user_id"),)
```

**Key Rules:**
- Use `uuid.UUID` for IDs, not `str`
- Use `str | None` for optional strings (Python 3.10+)
- Use `Field(foreign_key="table.column", ondelete="CASCADE")` for relations
- Always add `created_at` and `updated_at` timestamps
- Add indexes for foreign keys and frequently queried fields
- Use `sa_column=Column(Text)` for long text fields

### 2. Request/Response Schemas (Pydantic)

```python
from sqlmodel import SQLModel
import uuid
from datetime import datetime

class MyModelCreate(SQLModel):
    """Creation request schema."""
    
    name: str
    description: str | None = None

class MyModelUpdate(SQLModel):
    """Update request schema."""
    
    name: str | None = None
    description: str | None = None

class MyModelPublic(SQLModel):
    """Public response schema."""
    
    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
```

**Key Rules:**
- `Create` schemas: Required fields only
- `Update` schemas: All fields optional
- `Public` schemas: Include all safe fields for API responses
- Inherit from `SQLModel` (not `BaseModel`)

### 3. FastAPI Routes

```python
from fastapi import APIRouter, HTTPException, Query
from app.core.db import SessionDep
from app.utils.authentication import CurrentUser

router = APIRouter(prefix="/my-resource", tags=["my-resource"])

# ==================== CRUD Endpoints ====================

@router.get(
    "/{resource_id}",
    response_model=MyModelPublic,
    summary="Get Resource",
    operation_id="get_resource",
)
def get_resource(
    resource_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> MyModelPublic:
    """Get a specific resource by ID."""
    resource = session.get(MyModel, resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    # Verify ownership
    if resource.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return resource
```

**Key Rules:**
- Use section comments: `# ==================== Section Name ====================`
- Always specify `response_model`, `summary`, `operation_id`
- Use `SessionDep` for database session
- Use `CurrentUser` for authenticated user
- Return model instances directly (FastAPI handles serialization)
- Verify ownership before operations

### 4. Services Layer

```python
from sqlmodel import Session, select
from app.core.logger import logger

class MyService:
    """Business logic for my feature."""
    
    @staticmethod
    def get_or_create(session: Session, user_id: uuid.UUID, name: str) -> MyModel:
        """Get existing or create new resource."""
        statement = select(MyModel).where(
            MyModel.user_id == user_id,
            MyModel.name == name
        )
        existing = session.exec(statement).first()
        
        if existing:
            return existing
        
        new_resource = MyModel(user_id=user_id, name=name)
        session.add(new_resource)
        session.commit()
        session.refresh(new_resource)
        
        logger.info(f"Created new resource {new_resource.id} for user {user_id}")
        return new_resource

my_service = MyService()
```

**Key Rules:**
- Use static methods for stateless operations
- Accept `Session` as first parameter
- Use `select()` for queries, not raw SQL
- Always `commit()` and `refresh()` after creating/updating
- Log important operations
- Return type-hinted values

### 5. Import Conventions

**Standard Import Order:**
```python
# Standard library
import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

# Third-party
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import func, select
from sqlmodel import Field, Session, SQLModel

# Local - core
from app.core.config import settings
from app.core.db import SessionDep
from app.core.logger import logger

# Local - models
from app.models import MyModel, User

# Local - schemas
from app.schemas.my_schema import MyModelCreate, MyModelPublic

# Local - services/utils
from app.services.my_service import my_service
from app.utils.authentication import CurrentUser
```

**Critical Imports:**
- Logger: `from app.core.logger import logger` (NOT `config.logger`)
- Session: `from app.core.db import SessionDep`
- CurrentUser: `from app.utils.authentication import CurrentUser`
- Settings: `from app.core.config import settings`

### 6. Type Hints

**Always use modern Python 3.10+ syntax:**
```python
# ✅ Correct
name: str | None = None
tags: list[str] = []
metadata: dict[str, Any] = {}

# ❌ Wrong (old syntax)
name: Optional[str] = None
tags: List[str] = []
metadata: Dict[str, Any] = {}
```

### 7. Error Handling

```python
from fastapi import HTTPException
from app.core.logger import logger

try:
    result = dangerous_operation()
except Exception as e:
    logger.error(f"Operation failed: {str(e)}")
    raise HTTPException(status_code=500, detail="Internal server error")
```

**Common Status Codes:**
- `400` - Bad request (validation error)
- `401` - Unauthorized (not logged in)
- `403` - Forbidden (not allowed)
- `404` - Not found
- `500` - Internal server error

### 8. Database Queries

```python
from sqlmodel import select, func

# Simple query
statement = select(MyModel).where(MyModel.user_id == user_id)
results = session.exec(statement).all()

# With ordering
statement = select(MyModel).order_by(MyModel.created_at.desc())
results = session.exec(statement).all()

# With limit/offset
statement = select(MyModel).limit(10).offset(0)
results = session.exec(statement).all()

# Count
count_statement = select(func.count()).select_from(MyModel).where(MyModel.user_id == user_id)
total = session.exec(count_statement).one()

# Single result
resource = session.get(MyModel, resource_id)  # By primary key
resource = session.exec(statement).first()     # By query
```

### 9. Common Patterns

**Ownership Verification:**
```python
def verify_ownership(resource: MyModel, current_user: User) -> None:
    if resource.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized")
```

**Pagination:**
```python
from app.schemas.common import get_pagination_params, PaginationQueryParams

@router.get("/resources")
def list_resources(
    session: SessionDep,
    current_user: CurrentUser,
    pagination: PaginationQueryParams = Depends(get_pagination_params),
):
    # Use pagination.limit and pagination.offset
    pass
```

**Background Tasks:**
```python
from app.tasks.agent_tasks import run_agent_task

# Queue background task
run_agent_task.delay(thread_id=str(thread_id), agent_id=str(agent_id))
```

## Integration Points

### Model Manager (AI Models)
```python
from app.modules.ai_models.manager import model_manager

# Get model info
model = model_manager.get_model("gpt-4o")

# List models
models = model_manager.list_available_models(include_disabled=False)

# Get pricing
if model and model.pricing:
    cost = (tokens / 1_000_000) * model.pricing.input_cost_per_million_tokens
```

### Storage Service
```python
from app.services.storage_service import get_storage_service

storage = get_storage_service(prefix="knowledge-base")
file_path = await storage.save_file(
    file_content=content,
    filename="document.pdf",
    mime_type="application/pdf",
    path_parts=[str(user_id), "documents"]
)
```

## Alembic Migrations

**Create migration:**
```bash
cd backend
alembic revision --autogenerate -m "Add my_table"
```

**Migration file pattern:**
```python
"""Add my_table.

Revision ID: 001_add_my_table
Revises: previous_migration_id
Create Date: 2025-01-21
"""

from alembic import op
import sqlalchemy as sa
import sqlmodel

revision = "001_add_my_table"
down_revision = "previous_migration_id"

def upgrade() -> None:
    op.create_table(
        "my_table",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sqlmodel.sql.sqltypes.AutoString(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )

def downgrade() -> None:
    op.drop_table("my_table")
```

## Key Principles

1. **Type Safety**: Always use type hints
2. **Ownership**: Verify user owns resources before operations
3. **Logging**: Log important operations and errors
4. **Consistency**: Follow existing patterns
5. **Security**: Never trust user input, validate everything
6. **Performance**: Use indexes, pagination, and background tasks
7. **Error Handling**: Provide clear error messages
8. **Documentation**: Add docstrings to all public methods

## Quick Checklist

When creating new features:

- [ ] Models inherit from `SQLModel` with `table=True`
- [ ] Schemas inherit from `SQLModel`
- [ ] Routes have `response_model`, `summary`, `operation_id`
- [ ] Imports follow standard order
- [ ] Type hints use `str | None` syntax
- [ ] Logger imported from `app.core.logger`
- [ ] Ownership verification for user resources
- [ ] Indexes added for foreign keys
- [ ] Migrations created and tested
- [ ] No linter errors

