"""AI Model Manager for business logic and operations."""

from typing import Any

from app.core.config import settings
from app.core.logger import logger

from .models import Model, ModelCapability
from .registry import FREE_MODEL_ID, PREMIUM_MODEL_ID, registry


class ModelManager:
    """Manager for AI model operations and business logic."""

    def __init__(self):
        """Initialize the model manager."""
        self.registry = registry

    def get_model(self, model_id: str) -> Model | None:
        return self.registry.get(model_id)

    def resolve_model_id(self, model_id: str) -> str:
        # logger.debug(f"resolve_model_id called with: '{model_id}' (type: {type(model_id)})")

        resolved = self.registry.resolve_model_id(model_id)
        if resolved:
            return resolved

        return model_id

    def get_litellm_params(self, model_id: str, **override_params) -> dict[str, Any]:
        """Get complete LiteLLM parameters for a model from the registry."""
        model = self.get_model(model_id)
        if not model:
            logger.warning(
                f"Model '{model_id}' not found in registry, using basic params"
            )
            return {"model": model_id, "num_retries": 3, **override_params}

        params = model.get_litellm_params(**override_params)
        # logger.debug(f"Generated LiteLLM params for {model.name}: {list(params.keys())}")
        return params

    def get_default_model(self, tier: str = "free") -> Model | None:
        models = self.get_models_for_tier(tier)

        recommended = [m for m in models if m.recommended]
        if recommended:
            recommended = sorted(recommended, key=lambda m: -m.priority)
            return recommended[0]

        if models:
            models = sorted(models, key=lambda m: -m.priority)
            return models[0]

        return None

    def get_context_window(self, model_id: str, default: int = 31_000) -> int:
        return self.registry.get_context_window(model_id, default)

    def format_model_info(self, model_id: str) -> dict[str, Any]:
        model = self.get_model(model_id)
        if not model:
            return {"error": f"Model '{model_id}' not found"}

        return {
            "id": model.id,
            "name": model.name,
            "provider": model.provider,
            "context_window": model.context_window,
            "capabilities": model.capabilities,
            "pricing": {
                "input_per_million": model.pricing.input_cost_per_million_tokens,
                "output_per_million": model.pricing.output_cost_per_million_tokens,
            }
            if model.pricing
            else None,
            "enabled": model.enabled,
            "tier_availability": model.tier_availability,
            "priority": model.priority,
            "recommended": model.recommended,
        }

    def list_available_models(
        self, tier: str | None = None, include_disabled: bool = False
    ) -> list[dict[str, Any]]:
        # logger.debug(f"list_available_models called with tier='{tier}', include_disabled={include_disabled}")

        if tier:
            models = self.registry.get_by_tier(tier, enabled_only=not include_disabled)
            # logger.debug(f"Found {len(models)} models for tier '{tier}'")
        else:
            models = self.registry.get_all(enabled_only=not include_disabled)
            # logger.debug(f"Found {len(models)} total models")

        if not models:
            logger.warning(
                f"No models found for tier '{tier}' - this might indicate a configuration issue"
            )

        models = sorted(models, key=lambda m: (not m.is_free_tier, -m.priority, m.name))

        return [self.format_model_info(m.id) for m in models]

    async def get_default_model_for_user(self, client = None, user_id: str = None) -> str:
        try:
            if settings.ENVIRONMENT == "local":
                return PREMIUM_MODEL_ID

            return FREE_MODEL_ID
            # subscription_info = await subscription_service.get_subscription(user_id)
            # subscription = subscription_info.get("subscription")

            # is_paid_tier = False
            # if subscription:
            #     price_id = None
            #     if (
            #         subscription.get("items")
            #         and subscription["items"].get("data")
            #         and len(subscription["items"]["data"]) > 0
            #     ):
            #         price_id = subscription["items"]["data"][0]["price"]["id"]
            #     else:
            #         price_id = subscription.get("price_id")

            #     # Check if this is a paid tier by looking at the tier info
            #     tier_info = subscription_info.get("tier", {})
            #     if (
            #         tier_info
            #         and tier_info.get("name") != "free"
            #         and tier_info.get("name") != "none"
            #     ):
            #         is_paid_tier = True

            # if is_paid_tier:
            #     # logger.debug(f"Setting Default Premium Model for paid user {user_id}")
            #     return PREMIUM_MODEL_ID
            # else:
            #     # logger.debug(f"Setting Default Free Model for free user {user_id}")
            #     return FREE_MODEL_ID

        except Exception as e:
            logger.warning(f"Failed to determine user tier for {user_id}: {e}")
            return FREE_MODEL_ID

    def get_model_for_user(
        self, model_id: str, user_tier: str = "free"
    ) -> Model | None:
        """
        Get a model if it's available for the user's tier.

        Args:
            model_id: Model ID or alias
            user_tier: User's subscription tier (free, paid)

        Returns:
            Model if available for user tier, None otherwise
        """
        model = self.registry.get(model_id)
        if not model:
            logger.warning("model_not_found", model_id=model_id)
            return None

        if user_tier not in model.tier_availability:
            logger.warning(
                "model_not_available_for_tier",
                model_id=model_id,
                user_tier=user_tier,
                available_tiers=model.tier_availability,
            )
            return None

        return model

    def get_available_models(
        self, user_tier: str = "free", capability: ModelCapability | None = None
    ) -> list[Model]:
        """
        Get all models available for a user tier with optional capability filter.

        Args:
            user_tier: User's subscription tier
            capability: Optional capability to filter by

        Returns:
            List of available models
        """
        models = self.registry.get_by_tier(user_tier, enabled_only=True)

        if capability:
            models = [m for m in models if capability in m.capabilities]

        return models

    def get_recommended_model(
        self, user_tier: str = "paid", capability: ModelCapability | None = None
    ) -> Model | None:
        """
        Get the recommended model for a user tier.

        Args:
            user_tier: User's subscription tier
            capability: Optional required capability

        Returns:
            Recommended model if available, None otherwise
        """
        models = self.get_available_models(user_tier, capability)

        # Filter by recommended flag
        recommended_models = [m for m in models if m.recommended]

        if recommended_models:
            # Return highest priority recommended model
            return recommended_models[0]

        # If no recommended model, return highest priority model
        return models[0] if models else None

    def get_cheapest_model(
        self, user_tier: str = "free", capability: ModelCapability | None = None
    ) -> Model | None:
        """
        Get the cheapest model for a user tier with optional capability.

        Args:
            user_tier: User's subscription tier
            capability: Optional required capability

        Returns:
            Cheapest model if available, None otherwise
        """
        models = self.get_available_models(user_tier, capability)

        # Filter models with pricing information
        models_with_pricing = [m for m in models if m.pricing]

        if not models_with_pricing:
            return None

        # Sort by combined cost (input + output)
        return min(
            models_with_pricing,
            key=lambda m: (
                m.pricing.input_cost_per_million_tokens
                + m.pricing.output_cost_per_million_tokens
            ),
        )

    def calculate_cost(
        self,
        model_id: str,
        input_tokens: int,
        output_tokens: int,
    ) -> float | None:
        """
        Calculate the cost for a model usage.

        Args:
            model_id: Model ID or alias
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens

        Returns:
            Cost in USD, None if model not found or no pricing info
        """
        pricing = self.registry.get_pricing(model_id)
        if not pricing:
            return None

        input_cost = (input_tokens / 1_000_000) * pricing.input_cost_per_million_tokens
        output_cost = (
            output_tokens / 1_000_000
        ) * pricing.output_cost_per_million_tokens

        return input_cost + output_cost

    def estimate_tokens_from_cost(
        self,
        model_id: str,
        budget_usd: float,
        input_output_ratio: float = 0.5,
    ) -> dict[str, int] | None:
        """
        Estimate how many tokens can be processed within a budget.

        Args:
            model_id: Model ID or alias
            budget_usd: Available budget in USD
            input_output_ratio: Ratio of input to total tokens (0-1)

        Returns:
            Dictionary with estimated input and output tokens, None if no pricing
        """
        pricing = self.registry.get_pricing(model_id)
        if not pricing:
            return None

        # Calculate weighted average cost per token
        avg_cost_per_million = (
            pricing.input_cost_per_million_tokens * input_output_ratio
            + pricing.output_cost_per_million_tokens * (1 - input_output_ratio)
        )

        total_tokens = int((budget_usd / avg_cost_per_million) * 1_000_000)
        input_tokens = int(total_tokens * input_output_ratio)
        output_tokens = total_tokens - input_tokens

        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
        }

    def get_model_info(self, model_id: str) -> dict[str, Any] | None:
        """
        Get comprehensive information about a model.

        Args:
            model_id: Model ID or alias

        Returns:
            Dictionary with model information, None if not found
        """
        model = self.registry.get(model_id)
        if not model:
            return None

        return {
            "id": model.id,
            "name": model.name,
            "provider": model.provider,
            "aliases": model.aliases,
            "context_window": model.context_window,
            "capabilities": model.capabilities,
            "pricing": (
                {
                    "input_cost_per_million_tokens": model.pricing.input_cost_per_million_tokens,
                    "output_cost_per_million_tokens": model.pricing.output_cost_per_million_tokens,
                    "input_cost_per_token": model.pricing.input_cost_per_token,
                    "output_cost_per_token": model.pricing.output_cost_per_token,
                }
                if model.pricing
                else None
            ),
            "tier_availability": model.tier_availability,
            "priority": model.priority,
            "recommended": model.recommended,
            "enabled": model.enabled,
        }

    def get_models_by_budget(
        self,
        budget_usd: float,
        estimated_input_tokens: int,
        estimated_output_tokens: int,
        user_tier: str = "free",
        capability: ModelCapability | None = None,
    ) -> list[dict[str, Any]]:
        """
        Get models that fit within a budget with estimated costs.

        Args:
            budget_usd: Available budget in USD
            estimated_input_tokens: Expected input tokens
            estimated_output_tokens: Expected output tokens
            user_tier: User's subscription tier
            capability: Optional required capability

        Returns:
            List of models with cost estimates
        """
        models = self.get_available_models(user_tier, capability)
        results = []

        for model in models:
            if not model.pricing:
                continue

            cost = self.calculate_cost(
                model.id, estimated_input_tokens, estimated_output_tokens
            )
            if cost is None:
                continue

            if cost <= budget_usd:
                results.append(
                    {
                        "model_id": model.id,
                        "model_name": model.name,
                        "estimated_cost": cost,
                        "remaining_budget": budget_usd - cost,
                        "priority": model.priority,
                    }
                )

        # Sort by priority (highest first)
        return sorted(results, key=lambda x: x["priority"], reverse=True)

    def validate_model_for_task(
        self,
        model_id: str,
        required_capabilities: list[ModelCapability],
        user_tier: str = "free",
    ) -> dict[str, Any]:
        """
        Validate if a model is suitable for a task.

        Args:
            model_id: Model ID or alias
            required_capabilities: Required capabilities for the task
            user_tier: User's subscription tier

        Returns:
            Dictionary with validation results
        """
        model = self.registry.get(model_id)

        if not model:
            return {
                "valid": False,
                "reason": "Model not found",
                "model_id": model_id,
            }

        if not model.enabled:
            return {
                "valid": False,
                "reason": "Model is disabled",
                "model_id": model_id,
            }

        if user_tier not in model.tier_availability:
            return {
                "valid": False,
                "reason": f"Model not available for {user_tier} tier",
                "model_id": model_id,
                "available_tiers": model.tier_availability,
            }

        missing_capabilities = [
            cap for cap in required_capabilities if cap not in model.capabilities
        ]

        if missing_capabilities:
            return {
                "valid": False,
                "reason": "Model missing required capabilities",
                "model_id": model_id,
                "missing_capabilities": missing_capabilities,
            }

        return {
            "valid": True,
            "model_id": model.id,
            "model_name": model.name,
        }

    def compare_models(self, model_ids: list[str]) -> list[dict[str, Any]]:
        """
        Compare multiple models side by side.

        Args:
            model_ids: List of model IDs or aliases to compare

        Returns:
            List of model comparison data
        """
        comparisons = []

        for model_id in model_ids:
            info = self.get_model_info(model_id)
            if info:
                comparisons.append(info)

        return comparisons

    def get_fallback_model(
        self,
        primary_model_id: str,
        user_tier: str = "free",
        required_capabilities: list[ModelCapability] | None = None,
    ) -> Model | None:
        """
        Get a fallback model if primary model is unavailable.

        Args:
            primary_model_id: Primary model ID
            user_tier: User's subscription tier
            required_capabilities: Required capabilities

        Returns:
            Fallback model if available, None otherwise
        """
        primary_model = self.registry.get(primary_model_id)
        if not primary_model:
            return self.get_recommended_model(user_tier)

        # Get models from same provider first
        provider_models = self.registry.get_by_provider(
            primary_model.provider, enabled_only=True
        )

        # Filter by tier and capabilities
        available_models = [
            m
            for m in provider_models
            if user_tier in m.tier_availability and m.id != primary_model_id
        ]

        if required_capabilities:
            available_models = [
                m
                for m in available_models
                if all(cap in m.capabilities for cap in required_capabilities)
            ]

        if available_models:
            return available_models[0]

        # If no models from same provider, get recommended from any provider
        return self.get_recommended_model(user_tier)

    def log_model_usage(
        self,
        model_id: str,
        input_tokens: int,
        output_tokens: int,
        user_id: str | None = None,
    ) -> None:
        """
        Log model usage for analytics.

        Args:
            model_id: Model ID used
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            user_id: Optional user ID
        """
        cost = self.calculate_cost(model_id, input_tokens, output_tokens)

        logger.info(
            "model_usage",
            model_id=model_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
            estimated_cost=cost,
            user_id=user_id,
        )


# Global manager instance
model_manager = ModelManager()
