"""AI Model definitions and types."""

from enum import Enum

from pydantic import BaseModel, Field


class ModelProvider(Enum):
    """AI model providers."""

    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GOOGLE = "google"
    XAI = "xai"
    MOONSHOTAI = "moonshotai"
    OPENROUTER = "openrouter"
    BEDROCK = "bedrock"


class ModelCapability(Enum):
    """Model capabilities."""

    CHAT = "chat"
    FUNCTION_CALLING = "function_calling"
    VISION = "vision"
    THINKING = "thinking"
    WEB_SEARCH = "web_search"
    STRUCTURED_OUTPUT = "structured_output"


class ModelPricing(BaseModel):
    """Model pricing information."""

    input_cost_per_million_tokens: float = Field(
        ..., description="Cost per million input tokens in USD"
    )
    output_cost_per_million_tokens: float = Field(
        ..., description="Cost per million output tokens in USD"
    )

    @property
    def input_cost_per_token(self) -> float:
        return self.input_cost_per_million_tokens / 1_000_000

    @property
    def output_cost_per_token(self) -> float:
        return self.output_cost_per_million_tokens / 1_000_000


class ModelConfig(BaseModel):
    """Model-specific configuration."""

    extra_headers: dict[str, str] = Field(
        default_factory=dict, description="Additional headers for API requests"
    )


class Model(BaseModel):
    """AI model definition."""

    id: str = Field(..., description="Unique model identifier")
    name: str = Field(..., description="Human-readable model name")
    provider: ModelProvider = Field(..., description="Model provider")
    aliases: list[str] = Field(
        default=[], description="Alternative names/IDs for the model"
    )
    context_window: int = Field(
        default=128_000,
        description="Maximum context window size in tokens",
    )
    capabilities: list[ModelCapability] = Field(
        default_factory=list, description="Model capabilities"
    )
    pricing: ModelPricing | None = Field(
        default=None, description="Pricing information"
    )
    tier_availability: list[str] = Field(
        default_factory=list, description="Tiers where model is available (free, paid)"
    )
    priority: int = Field(
        default=0, description="Model priority for selection (higher is better)"
    )
    recommended: bool = Field(
        default=False, description="Whether this is a recommended model"
    )
    enabled: bool = Field(default=True, description="Whether model is enabled")
    config: ModelConfig = Field(
        default_factory=ModelConfig, description="Model-specific configuration"
    )

    class Config:
        """Pydantic config."""

        use_enum_values = True

    @property
    def is_free_tier(self) -> bool:
        return "free" in self.tier_availability
