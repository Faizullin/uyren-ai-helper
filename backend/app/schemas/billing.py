"""Pydantic schemas for billing and credit tracking."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlmodel import SQLModel


class CreditBalanceResponse(SQLModel):
    """Credit balance response schema."""

    balance: float
    lifetime_granted: float
    lifetime_used: float


class CreditTransactionPublic(SQLModel):
    """Public credit transaction schema."""

    id: uuid.UUID
    user_id: uuid.UUID
    amount: float
    balance_after: float
    transaction_type: str
    description: str
    reference_id: str | None
    created_at: datetime


class CreditTransactionsResponse(SQLModel):
    """Credit transactions list response."""

    transactions: list[CreditTransactionPublic]
    total: int
    limit: int
    offset: int


class CreditAccountSummary(SQLModel):
    """Credit account summary schema."""

    balance: float
    lifetime_granted: float
    lifetime_used: float
    created_at: str
    updated_at: str


class AddCreditsRequest(SQLModel):
    """Request to add credits to an account."""

    amount: float
    description: str


class ModelInfo(SQLModel):
    """AI model information schema."""

    id: str
    name: str
    provider: str
    input_cost_per_million: float
    output_cost_per_million: float
    context_window: int
    supports_vision: bool = False
    supports_function_calling: bool = True


class AvailableModelsResponse(SQLModel):
    """Available models response schema."""

    models: list[ModelInfo]
    total: int

