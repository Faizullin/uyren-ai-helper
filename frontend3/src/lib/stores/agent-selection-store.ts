'use client';

import { create } from 'zustand';

interface Agent {
  agent_id: string;
  name: string;
  metadata?: {
    is_suna_default?: boolean;
    [key: string]: any;
  };
}

interface AgentSelectionState {
  selectedAgentId: string | null;
  setSelectedAgent: (agentId: string | null) => void;
  initializeFromAgents: (agents: Agent[], defaultAgentId?: string, setSelectedAgent?: (id: string) => void) => void;
  getCurrentAgent: (agents: Agent[]) => Agent | null;
}

export const useAgentSelection = create<AgentSelectionState>((set, get) => ({
  selectedAgentId: null,

  setSelectedAgent: (agentId: string | null) => {
    set({ selectedAgentId: agentId });
  },

  initializeFromAgents: (agents: Agent[], defaultAgentId?: string, setSelectedAgent?: (id: string) => void) => {
    const { selectedAgentId } = get();

    // If no agent is selected, try to find a default one
    if (!selectedAgentId) {
      let defaultAgent: Agent | null = null;

      if (defaultAgentId) {
        defaultAgent = agents.find(agent => agent.agent_id === defaultAgentId) || null;
      }

      // If no specific default, try to find Suna default agent
      if (!defaultAgent) {
        defaultAgent = agents.find(agent => agent.metadata?.is_suna_default) || null;
      }

      // If still no default, use the first agent
      if (!defaultAgent && agents.length > 0) {
        defaultAgent = agents[0];
      }

      if (defaultAgent) {
        set({ selectedAgentId: defaultAgent.agent_id });
        if (setSelectedAgent) {
          setSelectedAgent(defaultAgent.agent_id);
        }
      }
    }
  },

  getCurrentAgent: (agents: Agent[]) => {
    const { selectedAgentId } = get();
    return selectedAgentId ? agents.find(agent => agent.agent_id === selectedAgentId) || null : null;
  },
}));