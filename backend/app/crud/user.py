"""User CRUD operations."""

import uuid

from sqlmodel import Session, func, select

from app.core.security import get_password_hash, verify_password
from app.models.user import User, UserPublic, UsersPublic
from app.schemas.user import UserCreate, UserUpdate


def get_user_by_email(session: Session, email: str) -> User | None:
    """Get user by email."""
    statement = select(User).where(User.email == email)
    return session.exec(statement).first()


def get_user_by_id(session: Session, user_id: uuid.UUID) -> User | None:
    """Get user by ID."""
    return session.get(User, user_id)


def get_users(session: Session, skip: int = 0, limit: int = 100) -> UsersPublic:
    """Get all users with pagination."""
    count_statement = select(func.count()).select_from(User)
    count = session.exec(count_statement).one()
    statement = select(User).offset(skip).limit(limit)
    users = session.exec(statement).all()
    return UsersPublic(
        data=[UserPublic.model_validate(user) for user in users],
        count=count,
    )


def create_user(session: Session, user_create: UserCreate) -> User:
    """Create new user."""
    user = User(
        email=user_create.email,
        hashed_password=get_password_hash(user_create.password),
        full_name=user_create.full_name,
        is_active=user_create.is_active,
        is_superuser=user_create.is_superuser,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def update_user(session: Session, user: User, user_update: UserUpdate) -> User:
    """Update user."""
    update_data = user_update.model_dump(exclude_unset=True)
    if "password" in update_data and update_data["password"]:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))

    user.sqlmodel_update(update_data)
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def delete_user(session: Session, user: User) -> None:
    """Delete user."""
    session.delete(user)
    session.commit()


def authenticate_user(session: Session, email: str, password: str) -> User | None:
    """Authenticate user by email and password."""
    user = get_user_by_email(session, email)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
