from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session, create_engine, select

from app.core.config import settings
from app.core.security import get_password_hash

engine = create_engine(str(settings.SQLALCHEMY_DATABASE_URI))


# Database session dependency (synchronous)
def get_db() -> Generator[Session, None, None]:
    """Get database session (synchronous)."""
    with Session(engine) as session:
        yield session


# Async database session context manager
@asynccontextmanager
async def get_db_async() -> AsyncGenerator[Session, None]:
    """Get database session (async context manager for background tasks)."""
    with Session(engine) as session:
        yield session


SessionDep = Annotated[Session, Depends(get_db)]


# make sure all SQLModel models are imported (app.models) before initializing DB
# otherwise, SQLModel might fail to initialize relationships properly
# for more details: https://github.com/fastapi/full-stack-fastapi-template/issues/28


def init_db(session: Session) -> None:
    # Tables should be created with Alembic migrations
    # But if you don't want to use migrations, create
    # the tables un-commenting the next lines
    # from sqlmodel import SQLModel

    # This works because the models are already imported and registered from app.models
    # SQLModel.metadata.create_all(engine)

    # Import here to avoid circular import
    from app.models import User

    user = session.exec(
        select(User).where(User.email == settings.FIRST_SUPERUSER)
    ).first()
    if not user:
        user = User(
            email=settings.FIRST_SUPERUSER,
            hashed_password=get_password_hash(settings.FIRST_SUPERUSER_PASSWORD),
            is_superuser=True,
        )
        session.add(user)
        session.commit()
        session.refresh(user)
