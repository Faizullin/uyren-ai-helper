"""Credit service for managing user credits and transactions."""

import json
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlmodel import Session

from app.core.logger import logger
from app.models.billing import CreditAccount, CreditTransaction


class CreditService:
    """Service for managing user credits and billing."""

    @staticmethod
    def get_or_create_account(session: Session, user_id: uuid.UUID) -> CreditAccount:
        """Get or create a credit account for a user."""
        statement = select(CreditAccount).where(CreditAccount.user_id == user_id)
        account = session.exec(statement).first()

        if not account:
            # Create new account with initial free credits
            account = CreditAccount(
                user_id=user_id,
                balance=Decimal("10.00"),  # Initial free credits
                lifetime_granted=Decimal("10.00"),
                lifetime_used=Decimal("0.00"),
            )
            session.add(account)
            session.commit()
            session.refresh(account)

            # Record the initial grant transaction
            transaction = CreditTransaction(
                user_id=user_id,
                amount=Decimal("10.00"),
                balance_after=Decimal("10.00"),
                transaction_type="initial_grant",
                description="Welcome! Initial free credits",
                reference_id=None,
                metadata=None,
            )
            session.add(transaction)
            session.commit()

            logger.info(f"Created new credit account for user {user_id} with $10 initial credits")

        return account

    @staticmethod
    def get_balance(session: Session, user_id: uuid.UUID) -> Decimal:
        """Get the current credit balance for a user."""
        account = CreditService.get_or_create_account(session, user_id)
        return account.balance

    @staticmethod
    def add_credits(
        session: Session,
        user_id: uuid.UUID,
        amount: Decimal,
        description: str,
        transaction_type: str = "admin_grant",
        reference_id: str | None = None,
        metadata: dict | None = None,
    ) -> tuple[Decimal, CreditTransaction]:
        """Add credits to a user's account."""
        if amount <= 0:
            raise ValueError("Amount must be positive")

        account = CreditService.get_or_create_account(session, user_id)

        # Update account balance
        account.balance += amount
        account.lifetime_granted += amount
        account.updated_at = datetime.now(timezone.utc)

        # Create transaction record
        transaction = CreditTransaction(
            user_id=user_id,
            amount=amount,
            balance_after=account.balance,
            transaction_type=transaction_type,
            description=description,
            reference_id=reference_id,
            metadata=json.dumps(metadata) if metadata else None,
        )

        session.add(transaction)
        session.commit()
        session.refresh(account)

        logger.info(
            f"Added {amount} credits to user {user_id}. New balance: {account.balance}"
        )

        return account.balance, transaction

    @staticmethod
    def deduct_credits(
        session: Session,
        user_id: uuid.UUID,
        amount: Decimal,
        description: str,
        reference_id: str | None = None,
        metadata: dict | None = None,
    ) -> dict:
        """Deduct credits from a user's account."""
        if amount <= 0:
            raise ValueError("Amount must be positive")

        account = CreditService.get_or_create_account(session, user_id)

        # Check if sufficient balance
        if account.balance < amount:
            return {
                "success": False,
                "error": "Insufficient credits",
                "required": float(amount),
                "available": float(account.balance),
            }

        # Update account balance
        account.balance -= amount
        account.lifetime_used += amount
        account.updated_at = datetime.now(timezone.utc)

        # Create transaction record (negative amount for deduction)
        transaction = CreditTransaction(
            user_id=user_id,
            amount=-amount,
            balance_after=account.balance,
            transaction_type="usage",
            description=description,
            reference_id=reference_id,
            metadata=json.dumps(metadata) if metadata else None,
        )

        session.add(transaction)
        session.commit()
        session.refresh(account)

        logger.info(
            f"Deducted {amount} credits from user {user_id}. New balance: {account.balance}"
        )

        return {
            "success": True,
            "amount_deducted": float(amount),
            "new_balance": float(account.balance),
        }

    @staticmethod
    def get_transactions(
        session: Session,
        user_id: uuid.UUID,
        limit: int = 50,
        offset: int = 0,
        transaction_type: str | None = None,
    ) -> tuple[list[CreditTransaction], int]:
        """Get transaction history for a user."""
        # Build query
        statement = (
            select(CreditTransaction)
            .where(CreditTransaction.user_id == user_id)
            .order_by(CreditTransaction.created_at.desc())
        )

        if transaction_type:
            statement = statement.where(
                CreditTransaction.transaction_type == transaction_type
            )

        # Get total count
        count_statement = (
            select(func.count())
            .select_from(CreditTransaction)
            .where(CreditTransaction.user_id == user_id)
        )
        if transaction_type:
            count_statement = count_statement.where(
                CreditTransaction.transaction_type == transaction_type
            )
        total = session.exec(count_statement).one()

        # Get paginated results
        statement = statement.limit(limit).offset(offset)
        transactions = session.exec(statement).all()

        return list(transactions), total

    @staticmethod
    def get_account_summary(session: Session, user_id: uuid.UUID) -> dict:
        """Get a summary of a user's credit account."""
        account = CreditService.get_or_create_account(session, user_id)

        return {
            "balance": float(account.balance),
            "lifetime_granted": float(account.lifetime_granted),
            "lifetime_used": float(account.lifetime_used),
            "created_at": account.created_at.isoformat(),
            "updated_at": account.updated_at.isoformat(),
        }


credit_service = CreditService()

