"""Unified agent loading and management."""

import uuid
from dataclasses import dataclass
from typing import Any

from sqlmodel import Session, select

from app.core.logger import logger
from app.models import Agent, AgentVersion, User

from .authentication import verify_agent_access


@dataclass
class AgentData:
    """
    Complete agent data including configuration.

    This is the unified representation of an agent with all its settings.
    """

    # Core agent fields
    id: uuid.UUID
    owner_id: uuid.UUID
    name: str
    description: str | None
    is_default: bool
    is_public: bool
    tags: list[str]
    icon_name: str | None
    icon_color: str | None
    icon_background: str | None
    created_at: str
    updated_at: str
    current_version_id: uuid.UUID | None
    version_count: int
    my_metadata: dict[str, Any] | None

    # Configuration fields (from version)
    system_prompt: str | None = None
    model: str | None = None
    configured_mcps: list[dict[str, Any]] | None = None
    custom_mcps: list[dict[str, Any]] | None = None
    agentpress_tools: dict[str, Any] | None = None
    config: dict[str, Any] | None = None

    # Version info
    version_name: str | None = None
    version_number: int | None = None
    version_status: str | None = None

    # Flags
    config_loaded: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for API responses."""
        result = {
            "id": str(self.id),
            "owner_id": str(self.owner_id),
            "name": self.name,
            "description": self.description,
            "is_default": self.is_default,
            "is_public": self.is_public,
            "tags": self.tags,
            "icon_name": self.icon_name,
            "icon_color": self.icon_color,
            "icon_background": self.icon_background,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "current_version_id": str(self.current_version_id)
            if self.current_version_id
            else None,
            "version_count": self.version_count,
            "my_metadata": self.my_metadata,
        }

        # Include config if loaded
        if self.config_loaded:
            result.update(
                {
                    "system_prompt": self.system_prompt,
                    "model": self.model,
                    "configured_mcps": self.configured_mcps or [],
                    "custom_mcps": self.custom_mcps or [],
                    "agentpress_tools": self.agentpress_tools or {},
                    "config": self.config,
                    "version_name": self.version_name,
                    "version_number": self.version_number,
                    "version_status": self.version_status,
                }
            )

        return result


class AgentLoader:
    """
    Unified agent loading service.

    Handles all agent data loading with consistent behavior across the app.
    """

    async def load_agent(
        self,
        session: Session,
        agent_id: uuid.UUID,
        current_user: User,
        load_config: bool = True,
    ) -> AgentData:
        """
        Load a single agent with full configuration.

        Args:
            session: Database session
            agent_id: Agent UUID to load
            current_user: Current user (for authorization)
            load_config: Whether to load version configuration

        Returns:
            AgentData with complete information

        Raises:
            HTTPException: If agent not found or access denied
        """

        # Load and verify access
        agent = await verify_agent_access(session, agent_id, current_user)

        # Create base AgentData
        agent_data = self._agent_to_data(agent)

        # Load configuration if requested
        if load_config and agent.current_version_id:
            await self._load_agent_config(session, agent_data)

        return agent_data

    async def load_default_agent(
        self,
        session: Session,
        current_user: User,
        load_config: bool = True,
    ) -> AgentData | None:
        """
        Load user's default agent.

        Args:
            session: Database session
            current_user: Current user
            load_config: Whether to load version configuration

        Returns:
            AgentData if default agent exists, None otherwise
        """
        statement = select(Agent).where(
            Agent.owner_id == current_user.id,
            Agent.is_default == True,  # noqa: E712
        )
        result = session.exec(statement)
        agent = result.first()

        if not agent:
            logger.debug(f"No default agent found for user {current_user.id}")
            return None

        agent_data = self._agent_to_data(agent)

        if load_config and agent.current_version_id:
            await self._load_agent_config(session, agent_data)

        return agent_data

    async def load_agents_list(
        self,
        session: Session,
        agents: list[Agent],
        load_config: bool = False,
    ) -> list[AgentData]:
        """
        Load multiple agents efficiently.

        Args:
            session: Database session
            agents: List of Agent models
            load_config: Whether to load configurations

        Returns:
            List of AgentData objects
        """
        agent_data_list = [self._agent_to_data(agent) for agent in agents]

        if load_config:
            await self._batch_load_configs(session, agent_data_list)

        return agent_data_list

    def _agent_to_data(self, agent: Agent) -> AgentData:
        """Convert Agent model to AgentData."""
        return AgentData(
            id=agent.id,
            owner_id=agent.owner_id,
            name=agent.name,
            description=agent.description,
            is_default=agent.is_default,
            is_public=agent.is_public,
            tags=agent.tags or [],
            icon_name=agent.icon_name,
            icon_color=agent.icon_color,
            icon_background=agent.icon_background,
            created_at=agent.created_at.isoformat(),
            updated_at=agent.updated_at.isoformat(),
            current_version_id=agent.current_version_id,
            version_count=agent.version_count,
            my_metadata=agent.my_metadata,
            config_loaded=False,
        )

    async def _load_agent_config(
        self,
        session: Session,
        agent_data: AgentData,
    ) -> None:
        """Load configuration for a single agent."""
        if not agent_data.current_version_id:
            self._load_fallback_config(agent_data)
            return

        try:
            version = session.get(AgentVersion, agent_data.current_version_id)

            if not version:
                logger.warning(
                    f"Version {agent_data.current_version_id} not found for agent {agent_data.id}"
                )
                self._load_fallback_config(agent_data)
                return

            # Load configuration from version
            agent_data.system_prompt = version.system_prompt
            agent_data.model = version.model
            agent_data.configured_mcps = version.configured_mcps or []
            agent_data.custom_mcps = version.custom_mcps or []
            agent_data.agentpress_tools = version.agentpress_tools or {}
            agent_data.config = version.config or {}
            agent_data.version_name = version.version_name
            agent_data.version_number = version.version_number
            agent_data.version_status = version.status
            agent_data.config_loaded = True

            logger.debug(
                f"Loaded config for agent {agent_data.id}, version {version.version_name}"
            )

        except Exception as e:
            logger.error(f"Failed to load config for agent {agent_data.id}: {str(e)}")
            self._load_fallback_config(agent_data)

    def _load_fallback_config(self, agent_data: AgentData) -> None:
        """Load safe fallback configuration."""
        agent_data.system_prompt = "You are a helpful AI assistant."
        agent_data.model = "gpt-4"
        agent_data.configured_mcps = []
        agent_data.custom_mcps = []
        agent_data.agentpress_tools = {}
        agent_data.config = {}
        agent_data.version_name = "fallback"
        agent_data.config_loaded = True

        logger.debug(f"Loaded fallback config for agent {agent_data.id}")

    async def _batch_load_configs(
        self,
        session: Session,
        agents: list[AgentData],
    ) -> None:
        """Batch load configurations for multiple agents."""
        # Get all version IDs
        version_ids = [a.current_version_id for a in agents if a.current_version_id]

        if not version_ids:
            return

        try:
            # Batch query versions
            statement = select(AgentVersion).where(AgentVersion.id.in_(version_ids))
            result = session.exec(statement)
            versions = result.all()

            # Create version map
            version_map = {v.agent_id: v for v in versions}

            # Apply configs
            for agent_data in agents:
                if agent_data.id in version_map:
                    version = version_map[agent_data.id]
                    agent_data.system_prompt = version.system_prompt
                    agent_data.model = version.model
                    agent_data.configured_mcps = version.configured_mcps or []
                    agent_data.custom_mcps = version.custom_mcps or []
                    agent_data.agentpress_tools = version.agentpress_tools or {}
                    agent_data.config = version.config or {}
                    agent_data.version_name = version.version_name
                    agent_data.version_number = version.version_number
                    agent_data.version_status = version.status
                    agent_data.config_loaded = True

            logger.debug(f"Batch loaded configs for {len(version_map)} agents")

        except Exception as e:
            logger.warning(f"Failed to batch load agent configs: {str(e)}")


# Singleton instance
_loader: AgentLoader | None = None


async def get_agent_loader() -> AgentLoader:
    """Get the global agent loader instance."""
    global _loader
    if _loader is None:
        _loader = AgentLoader()
    return _loader
