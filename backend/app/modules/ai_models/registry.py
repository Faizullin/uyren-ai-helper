"""AI Model registry."""

from app.core.config import settings

from .models import (
    Model,
    ModelCapability,
    ModelConfig,
    ModelPricing,
    ModelProvider,
)

FREE_MODEL_ID = "gemini/gemini-2.5-flash"

# Set premium model ID to OpenAI GPT-5
if settings.ENVIRONMENT == "local":
    PREMIUM_MODEL_ID = "openai/gpt-5"
else:  # STAGING or PRODUCTION
    PREMIUM_MODEL_ID = "openai/gpt-5"

is_local = settings.ENVIRONMENT == "local"


class ModelRegistry:
    """Registry for managing AI models."""

    def __init__(self):
        """Initialize the model registry."""
        self._models: dict[str, Model] = {}
        self._aliases: dict[str, str] = {}
        self._initialize_models()

    def _initialize_models(self):
        """Register all available models."""

        self.register(
            Model(
                id=(
                    "anthropic/claude-sonnet-4-5-20250929"
                    if is_local
                    else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0"
                ),
                name="Sonnet 4.5",
                provider=ModelProvider.ANTHROPIC,
                aliases=[
                    "claude-sonnet-4.5",
                    "anthropic/claude-sonnet-4.5",
                    "Claude Sonnet 4.5",
                    "claude-sonnet-4-5-20250929",
                    "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
                    "arn:aws:bedrock:us-west-2:935064898258:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0",
                    "bedrock/anthropic.claude-sonnet-4-5-20250929-v1:0",
                ],
                context_window=1_000_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.THINKING,
                ],
                pricing=ModelPricing(
                    input_cost_per_million_tokens=3.00,
                    output_cost_per_million_tokens=15.00,
                ),
                tier_availability=["paid"],
                priority=101,
                recommended=True,
                enabled=True,
                config=ModelConfig(
                    extra_headers={"anthropic-beta": "context-1m-2025-08-07"},
                ),
            )
        )

        self.register(
            Model(
                id=(
                    "anthropic/claude-sonnet-4-20250514"
                    if is_local
                    else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0"
                ),
                name="Sonnet 4",
                provider=ModelProvider.ANTHROPIC,
                aliases=[
                    "claude-sonnet-4",
                    "Claude Sonnet 4",
                    "claude-sonnet-4-20250514",
                    "arn:aws:bedrock:us-west-2:935064898258:inference-profile/us.anthropic.claude-sonnet-4-20250514-v1:0",
                    "bedrock/anthropic.claude-sonnet-4-20250514-v1:0",
                ],
                context_window=1_000_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.THINKING,
                ],
                pricing=ModelPricing(
                    input_cost_per_million_tokens=3.00,
                    output_cost_per_million_tokens=15.00,
                ),
                tier_availability=["paid"],
                priority=100,
                recommended=True,
                enabled=True,
                config=ModelConfig(
                    extra_headers={"anthropic-beta": "context-1m-2025-08-07"},
                ),
            )
        )

        self.register(
            Model(
                id=(
                    "anthropic/claude-3-7-sonnet-latest"
                    if is_local
                    else "bedrock/converse/arn:aws:bedrock:us-west-2:935064898258:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0"
                ),
                name="Sonnet 3.7",
                provider=ModelProvider.ANTHROPIC,
                aliases=[
                    "claude-3.7",
                    "Claude 3.7 Sonnet",
                    "claude-3-7-sonnet-latest",
                    "arn:aws:bedrock:us-west-2:935064898258:inference-profile/us.anthropic.claude-3-7-sonnet-20250219-v1:0",
                    "bedrock/anthropic.claude-3-7-sonnet-20250219-v1:0",
                ],
                context_window=200_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                ],
                pricing=ModelPricing(
                    input_cost_per_million_tokens=3.00,
                    output_cost_per_million_tokens=15.00,
                ),
                tier_availability=["paid"],
                priority=99,
                enabled=True,
            )
        )

        self.register(
            Model(
                id="xai/grok-4-fast-non-reasoning",
                name="Grok 4 Fast",
                provider=ModelProvider.XAI,
                aliases=["grok-4-fast-non-reasoning", "Grok 4 Fast"],
                context_window=2_000_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                ],
                pricing=ModelPricing(
                    input_cost_per_million_tokens=0.20,
                    output_cost_per_million_tokens=0.50,
                ),
                tier_availability=["paid"],
                priority=98,
                enabled=True,
            )
        )

        # GPT-5 - Premium Tier Model
        self.register(
            Model(
                id="openai/gpt-5",
                name="GPT-5",
                provider=ModelProvider.OPENAI,
                aliases=["gpt-5", "GPT-5"],
                context_window=400_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.STRUCTURED_OUTPUT,
                ],
                pricing=ModelPricing(
                    input_cost_per_million_tokens=1.25,
                    output_cost_per_million_tokens=10.00,
                ),
                tier_availability=["paid"],
                priority=99,
                recommended=True,
                enabled=True,
            )
        )

        self.register(
            Model(
                id="openai/gpt-5-mini",
                name="GPT-5 Mini",
                provider=ModelProvider.OPENAI,
                aliases=["gpt-5-mini", "GPT-5 Mini"],
                context_window=400_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.STRUCTURED_OUTPUT,
                ],
                pricing=ModelPricing(
                    input_cost_per_million_tokens=0.25,
                    output_cost_per_million_tokens=2.00,
                ),
                tier_availability=["free", "paid"],
                priority=96,
                enabled=True,
            )
        )

        # Gemini 2.5 Flash - Free Tier Model
        self.register(
            Model(
                id="gemini/gemini-2.5-flash",
                name="Gemini 2.5 Flash",
                provider=ModelProvider.GOOGLE,
                aliases=["gemini-2.5-flash", "Gemini 2.5 Flash", "gemini-flash"],
                context_window=1_000_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.STRUCTURED_OUTPUT,
                ],
                pricing=ModelPricing(
                    input_cost_per_million_tokens=0.075,
                    output_cost_per_million_tokens=0.30,
                ),
                tier_availability=["free", "paid"],
                priority=98,
                recommended=True,
                enabled=True,
            )
        )

        # Gemini 2.5 Pro - Premium Tier Model
        self.register(
            Model(
                id="gemini/gemini-2.5-pro",
                name="Gemini 2.5 Pro",
                provider=ModelProvider.GOOGLE,
                aliases=["gemini-2.5-pro", "Gemini 2.5 Pro"],
                context_window=2_000_000,
                capabilities=[
                    ModelCapability.CHAT,
                    ModelCapability.FUNCTION_CALLING,
                    ModelCapability.VISION,
                    ModelCapability.STRUCTURED_OUTPUT,
                ],
                pricing=ModelPricing(
                    input_cost_per_million_tokens=1.25,
                    output_cost_per_million_tokens=10.00,
                ),
                tier_availability=["paid"],
                priority=95,
                enabled=True,
            )
        )

    def register(self, model: Model) -> None:
        """
        Register a model in the registry.

        Args:
            model: Model to register
        """
        self._models[model.id] = model
        for alias in model.aliases:
            self._aliases[alias] = model.id

    def get(self, model_id: str) -> Model | None:
        """
        Get a model by ID or alias.

        Args:
            model_id: Model ID or alias

        Returns:
            Model if found, None otherwise
        """
        if model_id in self._models:
            return self._models[model_id]

        if model_id in self._aliases:
            actual_id = self._aliases[model_id]
            return self._models.get(actual_id)

        return None

    def get_all(self, enabled_only: bool = True) -> list[Model]:
        """
        Get all models.

        Args:
            enabled_only: If True, only return enabled models

        Returns:
            List of models
        """
        models = list(self._models.values())
        if enabled_only:
            models = [m for m in models if m.enabled]
        return sorted(models, key=lambda m: m.priority, reverse=True)

    def get_by_tier(self, tier: str, enabled_only: bool = True) -> list[Model]:
        """
        Get models by tier.

        Args:
            tier: Tier name (free, paid)
            enabled_only: If True, only return enabled models

        Returns:
            List of models
        """
        models = self.get_all(enabled_only)
        return [m for m in models if tier in m.tier_availability]

    def get_by_provider(
        self, provider: ModelProvider, enabled_only: bool = True
    ) -> list[Model]:
        """
        Get models by provider.

        Args:
            provider: Model provider
            enabled_only: If True, only return enabled models

        Returns:
            List of models
        """
        models = self.get_all(enabled_only)
        return [m for m in models if m.provider == provider]

    def get_by_capability(
        self, capability: ModelCapability, enabled_only: bool = True
    ) -> list[Model]:
        """
        Get models by capability.

        Args:
            capability: Model capability
            enabled_only: If True, only return enabled models

        Returns:
            List of models
        """
        models = self.get_all(enabled_only)
        return [m for m in models if capability in m.capabilities]

    def resolve_model_id(self, model_id: str) -> str | None:
        """
        Resolve a model ID or alias to the canonical model ID.

        Args:
            model_id: Model ID or alias

        Returns:
            Canonical model ID if found, None otherwise
        """
        model = self.get(model_id)
        return model.id if model else None

    def get_aliases(self, model_id: str) -> list[str]:
        """
        Get all aliases for a model.

        Args:
            model_id: Model ID

        Returns:
            List of aliases
        """
        model = self.get(model_id)
        return model.aliases if model else []

    def enable_model(self, model_id: str) -> bool:
        """
        Enable a model.

        Args:
            model_id: Model ID

        Returns:
            True if model was enabled, False if not found
        """
        model = self.get(model_id)
        if model:
            model.enabled = True
            return True
        return False

    def disable_model(self, model_id: str) -> bool:
        """
        Disable a model.

        Args:
            model_id: Model ID

        Returns:
            True if model was disabled, False if not found
        """
        model = self.get(model_id)
        if model:
            model.enabled = False
            return True
        return False

    def get_context_window(self, model_id: str, default: int = 31_000) -> int:
        """
        Get the context window size for a model.

        Args:
            model_id: Model ID
            default: Default value if model not found

        Returns:
            Context window size in tokens
        """
        model = self.get(model_id)
        return model.context_window if model else default

    def get_pricing(self, model_id: str) -> ModelPricing | None:
        """
        Get pricing information for a model.

        Args:
            model_id: Model ID

        Returns:
            Pricing information if available, None otherwise
        """
        model = self.get(model_id)
        return model.pricing if model else None


# Global registry instance
registry = ModelRegistry()
