"""Database models for billing and credit tracking."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Index, Numeric, Text
from sqlmodel import Column, Field, SQLModel


class CreditAccount(SQLModel, table=True):
    """Database ORM model for credit_accounts table."""

    __tablename__ = "credit_accounts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", ondelete="CASCADE", unique=True)
    balance: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(10, 2), nullable=False)
    )
    lifetime_granted: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(10, 2), nullable=False)
    )
    lifetime_used: Decimal = Field(
        default=Decimal("0"), sa_column=Column(Numeric(10, 2), nullable=False)
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (Index("ix_credit_accounts_user_id", "user_id"),)


class CreditTransaction(SQLModel, table=True):
    """Database ORM model for credit_transactions table."""

    __tablename__ = "credit_transactions"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", ondelete="CASCADE")
    amount: Decimal = Field(sa_column=Column(Numeric(10, 6), nullable=False))
    balance_after: Decimal = Field(sa_column=Column(Numeric(10, 2), nullable=False))
    transaction_type: str = Field(
        max_length=50
    )  # 'grant', 'usage', 'admin_grant', 'refund'
    description: str = Field(sa_column=Column(Text))
    reference_id: str | None = Field(
        default=None, max_length=255
    )  # agent_run_id, thread_id, etc.
    my_metadata: dict | None = Field(default=None, sa_column=Column(Text))
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    __table_args__ = (
        Index("ix_credit_transactions_user_id", "user_id"),
        Index("ix_credit_transactions_created_at", "created_at"),
        Index("ix_credit_transactions_type", "transaction_type"),
    )

