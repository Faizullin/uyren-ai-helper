import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AgentPublic } from '@/client/types.gen';

interface AgentSelectionState {
  selectedAgentId: string | undefined;
  hasInitialized: boolean;
  
  setSelectedAgent: (agentId: string | undefined) => void;
  initializeFromAgents: (agents: AgentPublic[], threadAgentId?: string, onAgentSelect?: (agentId: string | undefined) => void) => void;
  autoSelectAgent: (agents: AgentPublic[], onAgentSelect?: (agentId: string | undefined) => void, currentSelectedAgentId?: string) => void;
  clearSelection: () => void;
  
  getCurrentAgent: (agents: AgentPublic[]) => AgentPublic | null;
  isSunaAgent: (agents: AgentPublic[]) => boolean;
}

export const useAgentSelectionStore = create<AgentSelectionState>()(
  persist(
    (set, get) => ({
      selectedAgentId: undefined,
      hasInitialized: false,

      setSelectedAgent: (agentId: string | undefined) => {
        set({ selectedAgentId: agentId });
      },

      initializeFromAgents: (agents: AgentPublic[], threadAgentId?: string, onAgentSelect?: (agentId: string | undefined) => void) => {
        if (get().hasInitialized) {
          return;
        }

        let selectedId: string | undefined;

        if (threadAgentId) {
          selectedId = threadAgentId;
        } else if (typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const agentIdFromUrl = urlParams.get('agent_id');
          if (agentIdFromUrl) {
            selectedId = agentIdFromUrl;
          }
        }

        if (!selectedId) {
          const current = get().selectedAgentId;
          
          if (current && agents.some(a => a.id === current)) {
            selectedId = current;
          } else if (agents.length > 0) {
            const defaultSunaAgent = agents.find(agent => agent.is_default);
            selectedId = defaultSunaAgent ? defaultSunaAgent.id : agents[0].id;
          }
        }

        if (selectedId) {
          set({ selectedAgentId: selectedId });
        }

        if (selectedId && onAgentSelect) {
          onAgentSelect(selectedId);
        }

        set({ hasInitialized: true });
      },

      autoSelectAgent: (agents: AgentPublic[], onAgentSelect?: (agentId: string | undefined) => void, currentSelectedAgentId?: string) => {
        if (agents.length === 0 || currentSelectedAgentId) {
          return;
        }
        const defaultSunaAgent = agents.find(agent => agent.is_default);
        const agentToSelect = defaultSunaAgent || agents[0];
        
        if (agentToSelect) {
          if (onAgentSelect) {
            onAgentSelect(agentToSelect.id);
          } else {
            set({ selectedAgentId: agentToSelect.id });
          }
        }
      },

      clearSelection: () => {
        set({ selectedAgentId: undefined, hasInitialized: false });
      },

      getCurrentAgent: (agents: AgentPublic[]) => {
        const { selectedAgentId } = get();
        return selectedAgentId 
          ? agents.find(agent => agent.id === selectedAgentId) || null
          : null;
      },

      isSunaAgent: (agents: AgentPublic[]) => {
        const { selectedAgentId } = get();
        const currentAgent = selectedAgentId 
          ? agents.find(agent => agent.id === selectedAgentId)
          : null;
        return currentAgent?.is_default || selectedAgentId === undefined;
      },
    }),
    {
      name: 'agent-selection-storage',
      partialize: (state) => ({ 
        selectedAgentId: state.selectedAgentId 
      }),
    }
  )
);