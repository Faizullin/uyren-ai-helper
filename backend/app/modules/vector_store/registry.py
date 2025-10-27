"""Vector Store Registry for Supabase pgvector configuration."""

from app.modules.vector_store.models import VectorStoreConfig, VectorStoreProvider


class VectorStoreRegistry:
    """Registry for Supabase vector store configuration."""

    def __init__(self):
        self._configs: dict[str, VectorStoreConfig] = {}
        self._initialize_supabase_config()

    def _initialize_supabase_config(self):
        """Initialize Supabase pgvector configuration."""

        # Supabase with pgvector configuration
        self.register(
            VectorStoreConfig(
                provider=VectorStoreProvider.SUPABASE,
                name="Supabase Vector Store",
                description="Vector search using Supabase PostgreSQL with pgvector extension",
                config={
                    "table_name": "document_embeddings",
                    "vector_dimension": 1536,
                    "index_type": "ivfflat",
                    "metric": "cosine",
                    "lists": 100,
                    "similarity_threshold": 0.7,
                    "match_count": 10,
                },
                embedding_model="text-embedding-3-small",
                embedding_dimension=1536,
                batch_size=100,
                max_retries=3,
                timeout=30,
            )
        )

    def register(self, config: VectorStoreConfig) -> None:
        """Register a vector store configuration."""
        self._configs[config.provider.value] = config

    def get_config(self, provider: VectorStoreProvider) -> VectorStoreConfig | None:
        """Get configuration for a specific provider."""
        return self._configs.get(provider.value)

    def list_providers(self) -> list[str]:
        """List all available providers."""
        return list(self._configs.keys())

    def get_all_configs(self) -> dict[str, VectorStoreConfig]:
        """Get all registered configurations."""
        return self._configs.copy()

    def is_provider_supported(self, provider: VectorStoreProvider) -> bool:
        """Check if a provider is supported."""
        return provider.value in self._configs

    def get_provider_info(self, provider: VectorStoreProvider) -> dict[str, str] | None:
        """Get basic info about a provider."""
        config = self.get_config(provider)
        if not config:
            return None

        return {
            "name": config.name,
            "description": config.description or "",
            "provider": config.provider.value,
            "embedding_model": config.embedding_model.value,
            "embedding_dimension": str(config.embedding_dimension),
            "batch_size": str(config.batch_size),
        }


# Global registry instance
vector_store_registry = VectorStoreRegistry()
