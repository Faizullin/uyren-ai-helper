"""Usage tracking and credit deduction for AI operations."""

from decimal import Decimal

from sqlmodel import Session

from app.core.logger import logger
from app.models.agent_run import AgentRun
from app.models.thread import Thread
from app.modules.ai_models.manager import model_manager
from app.services.credit_service import credit_service


class UsageTracker:
    """Track AI usage and deduct credits."""

    @staticmethod
    def record_agent_run_usage(
        session: Session,
        agent_run: AgentRun,
        input_tokens: int,
        output_tokens: int,
        model_id: str,
    ) -> dict:
        """
        Record usage for an agent run and deduct credits.

        Args:
            session: Database session
            agent_run: The agent run to record usage for
            input_tokens: Number of input tokens used
            output_tokens: Number of output tokens used
            model_id: ID of the model used

        Returns:
            Dict with success status and details
        """
        # Calculate cost using model manager
        cost = model_manager.calculate_cost(model_id, input_tokens, output_tokens)

        # Get model info for name
        model = model_manager.get_model(model_id)
        if cost is None or not model:
            logger.warning(f"Model {model_id} not found or missing pricing, using minimal cost")
            cost = 0.01  # Default minimal cost
            model_name = model_id
        else:
            model_name = model.name

        # Update agent run with usage info
        agent_run.input_tokens = input_tokens
        agent_run.output_tokens = output_tokens
        agent_run.total_cost = cost
        agent_run.model_used = model_id

        # Get thread to find user
        thread = session.get(Thread, agent_run.thread_id)
        if not thread:
            logger.error(f"Thread {agent_run.thread_id} not found for agent run {agent_run.id}")
            return {
                "success": False,
                "error": "Thread not found",
            }

        description = f"Agent run - {model_name} ({input_tokens:,} input + {output_tokens:,} output tokens)"

        result = credit_service.deduct_credits(
            session=session,
            user_id=thread.owner_id,
            amount=Decimal(str(cost)),
            description=description,
            reference_id=str(agent_run.id),
            my_metadata={
                "agent_run_id": str(agent_run.id),
                "thread_id": str(agent_run.thread_id),
                "model_id": model_id,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_cost": cost,
            },
        )

        if result["success"]:
            logger.info(
                f"Deducted ${cost:.6f} for agent run {agent_run.id} "
                f"({input_tokens:,} + {output_tokens:,} tokens, {model_name})"
            )
        else:
            logger.warning(
                f"Failed to deduct credits for agent run {agent_run.id}: {result.get('error')}"
            )

        session.commit()
        session.refresh(agent_run)

        return result


usage_tracker = UsageTracker()

