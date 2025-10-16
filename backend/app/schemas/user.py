"""User Pydantic schemas."""

from pydantic import EmailStr
from sqlmodel import Field, SQLModel


# Auth schemas
class LoginRequest(SQLModel):
    """Login request schema."""

    email: EmailStr
    password: str


class LoginResponse(SQLModel):
    """Login response schema."""

    access_token: str
    token_type: str = "bearer"


class RegisterRequest(SQLModel):
    """Register request schema."""

    email: EmailStr
    password: str
    full_name: str | None = None


class RegisterResponse(SQLModel):
    """Register response schema."""

    id: str
    email: EmailStr
    full_name: str | None = None


class TokenPayload(SQLModel):
    """Token payload schema."""

    sub: str | None = None


class PasswordResetRequest(SQLModel):
    """Password reset request schema."""

    email: EmailStr


class PasswordResetConfirm(SQLModel):
    """Password reset confirm schema."""

    token: str
    new_password: str


class PasswordChange(SQLModel):
    """Password change schema."""

    current_password: str
    new_password: str


# User management schemas
class UserCreate(SQLModel):
    """User creation schema (admin)."""

    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255)
    is_active: bool = True
    is_superuser: bool = False


class UserUpdate(SQLModel):
    """User update schema (admin)."""

    email: EmailStr | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=40)
    full_name: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    is_superuser: bool | None = None


class UserUpdateMe(SQLModel):
    """User self-update schema."""

    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    """Password update schema."""

    current_password: str = Field(min_length=8, max_length=40)
    new_password: str = Field(min_length=8, max_length=40)

