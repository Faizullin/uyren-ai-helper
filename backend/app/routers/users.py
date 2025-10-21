"""User and authentication routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from app.core.config import settings
from app.core.db import SessionDep
from app.core.security import get_password_hash, verify_password
from app.crud.user import (
    authenticate_user,
    create_user,
    delete_user,
    get_user_by_email,
    get_user_by_id,
    get_users,
    update_user,
)
from app.models import UserPublic, UsersPublic
from app.schemas.common import Message
from app.schemas.user import (
    LoginRequest,
    LoginResponse,
    RegisterRequest,
    RegisterResponse,
    UpdatePassword,
    UserCreate,
    UserUpdate,
    UserUpdateMe,
)
from app.services import generate_new_account_email, send_email
from app.utils import create_access_token
from app.utils.authentication import CurrentSuperuser, CurrentUser, normalize_email

router = APIRouter(tags=["users"])


# ==================== Auth Endpoints ====================


@router.post(
    "/users/login/access-token",
    response_model=LoginResponse,
    tags=["auth"],
    summary="Login with Access Token",
    operation_id="login_access_token",
)
def login_access_token(
    session: SessionDep, form_data: OAuth2PasswordRequestForm = Depends()
) -> LoginResponse:
    """OAuth2 compatible token login."""
    user = authenticate_user(session, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token = create_access_token(subject=user.email)
    return LoginResponse(access_token=access_token, token_type="bearer")


@router.post(
    "/users/login",
    response_model=LoginResponse,
    tags=["auth"],
    summary="Login User",
    operation_id="login",
)
def login(session: SessionDep, data: LoginRequest) -> LoginResponse:
    """Login with email and password."""
    user = authenticate_user(session, data.email, data.password)
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    access_token = create_access_token(subject=user.email)
    return LoginResponse(access_token=access_token, token_type="bearer")


@router.post(
    "/users/register",
    response_model=RegisterResponse,
    tags=["auth"],
    summary="Register User",
    operation_id="register",
)
def register(session: SessionDep, data: RegisterRequest) -> RegisterResponse:
    """Register new user."""
    email = normalize_email(data.email)

    # Check if user exists
    existing_user = get_user_by_email(session, email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    user_create = UserCreate(
        email=email,
        password=data.password,
        full_name=data.full_name,
        is_active=True,
        is_superuser=False,
    )
    user = create_user(session, user_create)

    return RegisterResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
    )


# ==================== User Management (Admin) ====================


@router.get(
    "/users",
    response_model=UsersPublic,
    summary="List Users",
    operation_id="list_users",
)
def read_users(
    session: SessionDep,
    _: CurrentSuperuser,
    skip: int = 0,
    limit: int = 100,
) -> UsersPublic:
    """Get all users (superuser only)."""
    return get_users(session, skip=skip, limit=limit)


@router.post(
    "/users",
    response_model=UserPublic,
    summary="Create User",
    operation_id="create_user",
)
def create_user_endpoint(
    session: SessionDep,
    user_in: UserCreate,
    _: CurrentSuperuser,
) -> UserPublic:
    """Create new user (superuser only)."""
    email = normalize_email(user_in.email)

    # Check if user exists
    existing_user = get_user_by_email(session, email)
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Update email in user_in
    user_in.email = email
    user = create_user(session, user_in)

    # Send email if enabled
    if settings.emails_enabled:
        email_data = generate_new_account_email(
            email_to=email, username=email, password=user_in.password
        )
        send_email(
            email_to=email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )

    return UserPublic.model_validate(user)


@router.get(
    "/users/{user_id}",
    response_model=UserPublic,
    summary="Get User by ID",
    operation_id="get_user_by_id",
)
def read_user_by_id(
    user_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> UserPublic:
    """Get user by ID. Own profile or superuser only."""
    user = get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return UserPublic.model_validate(user)


@router.patch(
    "/users/{user_id}",
    response_model=UserPublic,
    summary="Update User",
    operation_id="update_user",
)
def update_user_endpoint(
    user_id: uuid.UUID,
    user_in: UserUpdate,
    session: SessionDep,
    _: CurrentSuperuser,
) -> UserPublic:
    """Update user (superuser only)."""
    user = get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check email uniqueness
    if user_in.email:
        email = normalize_email(user_in.email)
        existing = get_user_by_email(session, email)
        if existing and existing.id != user_id:
            raise HTTPException(status_code=400, detail="Email already registered")
        user_in.email = email

    user = update_user(session, user, user_in)
    return UserPublic.model_validate(user)


@router.delete(
    "/users/{user_id}",
    response_model=Message,
    summary="Delete User",
    operation_id="delete_user",
)
def delete_user_endpoint(
    user_id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentSuperuser,
) -> Message:
    """Delete user (superuser only)."""
    user = get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id and user.is_superuser:
        raise HTTPException(
            status_code=400, detail="Superusers cannot delete themselves"
        )
    delete_user(session, user)
    return Message(message="User deleted successfully")


# ==================== Self Management ====================


@router.get(
    "/users/me/profile",
    response_model=UserPublic,
    summary="Get Current User Profile",
    operation_id="get_current_user_profile",
)
def read_user_me(current_user: CurrentUser) -> UserPublic:
    """Get current user profile."""
    return UserPublic.model_validate(current_user)


@router.patch(
    "/users/me/profile",
    response_model=UserPublic,
    summary="Update Current User Profile",
    operation_id="update_current_user_profile",
)
def update_user_me(
    session: SessionDep,
    user_in: UserUpdateMe,
    current_user: CurrentUser,
) -> UserPublic:
    """Update current user profile."""
    # Check email uniqueness
    if user_in.email:
        email = normalize_email(user_in.email)
        existing = get_user_by_email(session, email)
        if existing and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail="Email already registered")
        user_in.email = email

    # Update user
    update_data = user_in.model_dump(exclude_unset=True)
    current_user.sqlmodel_update(update_data)
    session.add(current_user)
    session.commit()
    session.refresh(current_user)
    return UserPublic.model_validate(current_user)


@router.patch(
    "/users/me/password",
    response_model=Message,
    summary="Update Current User Password",
    operation_id="update_current_user_password",
)
def update_password_me(
    session: SessionDep,
    body: UpdatePassword,
    current_user: CurrentUser,
) -> Message:
    """Update current user password."""
    if not verify_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    if body.current_password == body.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password cannot be the same as current password",
        )
    current_user.hashed_password = get_password_hash(body.new_password)
    session.add(current_user)
    session.commit()
    return Message(message="Password updated successfully")


@router.delete(
    "/users/me",
    response_model=Message,
    summary="Delete Current User Account",
    operation_id="delete_current_user_account",
)
def delete_user_me(
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    """Delete current user account."""
    if current_user.is_superuser:
        raise HTTPException(
            status_code=400, detail="Superusers cannot delete themselves"
        )
    delete_user(session, current_user)
    return Message(message="User deleted successfully")
