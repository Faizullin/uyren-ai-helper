"""Billing and credit management routes."""

from decimal import Decimal

from fastapi import APIRouter, HTTPException, Query

from app.core.db import SessionDep
from app.modules.ai_models.manager import model_manager
from app.schemas.billing import (
    AddCreditsRequest,
    AvailableModelsResponse,
    CreditAccountSummary,
    CreditBalanceResponse,
    CreditTransactionPublic,
    CreditTransactionsResponse,
    ModelInfo,
)
from app.services.credit_service import credit_service
from app.utils.authentication import CurrentUser

router = APIRouter(prefix="/billing", tags=["billing"])


# ==================== Credit Balance Endpoints ====================


@router.get(
    "/balance",
    response_model=CreditBalanceResponse,
    summary="Get Credit Balance",
    operation_id="get_credit_balance",
)
def get_balance(
    session: SessionDep,
    current_user: CurrentUser,
) -> CreditBalanceResponse:
    """Get the current credit balance for the authenticated user."""
    balance = credit_service.get_balance(session, current_user.id)
    account = credit_service.get_or_create_account(session, current_user.id)

    return CreditBalanceResponse(
        balance=float(balance),
        lifetime_granted=float(account.lifetime_granted),
        lifetime_used=float(account.lifetime_used),
    )


@router.get(
    "/summary",
    response_model=CreditAccountSummary,
    summary="Get Account Summary",
    operation_id="get_account_summary",
)
def get_account_summary(
    session: SessionDep,
    current_user: CurrentUser,
) -> CreditAccountSummary:
    """Get a detailed summary of the user's credit account."""
    summary = credit_service.get_account_summary(session, current_user.id)
    return CreditAccountSummary(**summary)


# ==================== Transaction History Endpoints ====================


@router.get(
    "/transactions",
    response_model=CreditTransactionsResponse,
    summary="Get Transaction History",
    operation_id="get_transactions",
)
def get_transactions(
    session: SessionDep,
    current_user: CurrentUser,
    limit: int = Query(50, ge=1, le=100, description="Number of transactions to fetch"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    transaction_type: str | None = Query(
        None, description="Filter by transaction type"
    ),
) -> CreditTransactionsResponse:
    """Get transaction history for the authenticated user."""
    transactions, total = credit_service.get_transactions(
        session, current_user.id, limit, offset, transaction_type
    )

    return CreditTransactionsResponse(
        transactions=[
            CreditTransactionPublic(
                id=t.id,
                user_id=t.user_id,
                amount=float(t.amount),
                balance_after=float(t.balance_after),
                transaction_type=t.transaction_type,
                description=t.description,
                reference_id=t.reference_id,
                created_at=t.created_at,
            )
            for t in transactions
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


# ==================== Credit Management Endpoints ====================


@router.post(
    "/credits/add",
    response_model=CreditBalanceResponse,
    summary="Add Credits (Admin)",
    operation_id="add_credits",
)
def add_credits(
    request: AddCreditsRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> CreditBalanceResponse:
    """
    Add credits to the current user's account.

    Note: In a production system, this would be restricted to admin users only.
    For now, users can add credits to their own account for testing.
    """
    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    new_balance, _ = credit_service.add_credits(
        session=session,
        user_id=current_user.id,
        amount=Decimal(str(request.amount)),
        description=request.description,
        transaction_type="admin_grant",
    )

    account = credit_service.get_or_create_account(session, current_user.id)

    return CreditBalanceResponse(
        balance=float(new_balance),
        lifetime_granted=float(account.lifetime_granted),
        lifetime_used=float(account.lifetime_used),
    )


# ==================== AI Models Endpoints ====================


@router.get(
    "/available-models",
    response_model=AvailableModelsResponse,
    summary="Get Available AI Models",
    operation_id="get_available_models",
)
def get_available_models(
    _current_user: CurrentUser,
) -> AvailableModelsResponse:
    """Get list of available AI models with pricing information."""
    # Get all available models from the model manager
    models_data = model_manager.list_available_models(include_disabled=False)

    model_list = []
    for m in models_data:
        # Only include models with pricing information
        if m.get("pricing"):
            model_list.append(
                ModelInfo(
                    id=m["id"],
                    name=m["name"],
                    provider=m["provider"],
                    input_cost_per_million=m["pricing"]["input_per_million"],
                    output_cost_per_million=m["pricing"]["output_per_million"],
                    context_window=m["context_window"],
                    supports_vision="vision" in m.get("capabilities", []),
                    supports_function_calling="function_calling"
                    in m.get("capabilities", []),
                )
            )

    return AvailableModelsResponse(models=model_list, total=len(model_list))
