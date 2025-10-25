import { AgentsService } from '@/client';
import type { AgentCreate, AgentUpdate, ListAgentsData, AgentPublic } from '@/client/types.gen';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRef, useCallback, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';

export function useAgents(params?: ListAgentsData['query'], options?: {
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ['agents', params],
    queryFn: async () => {
      const response = await AgentsService.list_agents({
        query: params,
      });
      // The response is wrapped by axios, access the actual data
      return response.data;
    },
    enabled: options?.enabled !== false,
    ...options,
  });
}

export function useAgent(agentId: string) {
  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => {
      const response = await AgentsService.get_agent({ path: { agent_id: agentId } });
      // Unwrap axios response to get actual data
      return response.data;
    },
    enabled: !!agentId,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agent: AgentCreate) =>
      AgentsService.create_agent({ body: agent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create agent');
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ agentId, ...updates }: AgentUpdate & { agentId: string }) =>
      AgentsService.update_agent({
        path: { agent_id: agentId },
        body: updates as AgentUpdate,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['agent', variables.agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update agent');
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agentId: string) =>
      AgentsService.delete_agent({ path: { agent_id: agentId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete agent');
    },
  });
}

export function useCreateNewAgent() {
  const router = useRouter();
  const createAgentMutation = useCreateAgent();
  
  return useMutation({
    mutationFn: async (_: void) => {
      const defaultAgentData: AgentCreate = {
        name: 'New Agent',
        description: 'A newly created agent, open for configuration',
        system_prompt: '',
        model: null,
        is_default: false,
        tags: [],
        icon_name: 'brain',
        icon_color: '#000000',
        icon_background: '#F3F4F6',
      };

      const response = await createAgentMutation.mutateAsync(defaultAgentData);
      return response.data;
    },
    onSuccess: (newAgent) => {
      // Navigate to agent configuration or stay on current page
    },
    onError: (error) => {
      console.error('Error creating agent:', error);
      toast.error('Failed to create agent. Please try again.');
    },
  });
}

export function useOptimisticAgentUpdate() {
  const queryClient = useQueryClient();
  
  return {
    optimisticallyUpdateAgent: (agentId: string, updates: Partial<AgentPublic>) => {
      queryClient.setQueryData(
        ['agent', agentId],
        (oldData: AgentPublic | undefined) => {
          if (!oldData) return oldData;
          return { ...oldData, ...updates };
        }
      );
    },
    
    revertOptimisticUpdate: (agentId: string) => {
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
    },
  };
}

export function useAgentDeletionState() {
  const [deletingAgents, setDeletingAgents] = useState<Set<string>>(new Set());
  const deleteAgentMutation = useDeleteAgent();

  const deleteAgent = useCallback(async (agentId: string) => {
    // Add to deleting set immediately for UI feedback
    setDeletingAgents(prev => new Set(prev).add(agentId));
    
    try {
      await deleteAgentMutation.mutateAsync(agentId);
    } finally {
      // Remove from deleting set regardless of success/failure
      setDeletingAgents(prev => {
        const newSet = new Set(prev);
        newSet.delete(agentId);
        return newSet;
      });
    }
  }, [deleteAgentMutation]);

  return {
    deleteAgent,
    isDeletingAgent: (agentId: string) => deletingAgents.has(agentId),
    isDeleting: deleteAgentMutation.isPending,
  };
}

/**
 * Hook to get an agent from the cache without fetching.
 * This checks all cached agent list queries to find the agent.
 * Returns undefined if not found in cache.
 */
export function useAgentFromCache(agentId: string | undefined): AgentPublic | undefined {
  const queryClient = useQueryClient();
  
  return useMemo(() => {
    if (!agentId) return undefined;

    // First check if we have it in the detail cache
    const cachedAgent = queryClient.getQueryData<AgentPublic>(['agent', agentId]);
    if (cachedAgent) return cachedAgent;

    // Otherwise, search through all agent list caches
    const allAgentLists = queryClient.getQueriesData<{ agents: AgentPublic[] }>({ 
      queryKey: ['agents'] 
    });

    for (const [_, data] of allAgentLists) {
      if (data?.agents) {
        const found = data.agents.find(agent => agent.id === agentId);
        if (found) return found;
      }
    }

    return undefined;
  }, [agentId, queryClient]);
}

/**
 * Hook to get multiple agents from cache by IDs.
 * Returns a map of agentId -> Agent for quick lookup.
 */
export function useAgentsFromCache(agentIds: string[]): Map<string, AgentPublic> {
  const queryClient = useQueryClient();
  
  return useMemo(() => {
    const agentsMap = new Map<string, AgentPublic>();
    
    if (!agentIds || agentIds.length === 0) return agentsMap;

    // Get all cached agent list queries
    const allAgentLists = queryClient.getQueriesData<{ agents: AgentPublic[] }>({ 
      queryKey: ['agents'] 
    });

    // Build a map of all cached agents
    const allCachedAgents = new Map<string, AgentPublic>();
    for (const [_, data] of allAgentLists) {
      if (data?.agents) {
        data.agents.forEach(agent => {
          allCachedAgents.set(agent.id, agent);
        });
      }
    }

    // Also check individual agent caches
    for (const agentId of agentIds) {
      const cachedAgent = queryClient.getQueryData<AgentPublic>(['agent', agentId]);
      if (cachedAgent) {
        allCachedAgents.set(agentId, cachedAgent);
      }
    }

    // Return only the requested agents
    for (const agentId of agentIds) {
      const agent = allCachedAgents.get(agentId);
      if (agent) {
        agentsMap.set(agentId, agent);
      }
    }

    return agentsMap;
  }, [agentIds, queryClient]);
}

/**
 * Hook for managing agent form state with validation and submission
 */
export function useAgentForm(initialAgent?: AgentPublic) {
  const [formData, setFormData] = useState<Partial<AgentCreate>>({
    name: initialAgent?.name || '',
    description: initialAgent?.description || '',
    system_prompt: '',
    model: null,
    icon_name: initialAgent?.icon_name || 'brain',
    icon_color: initialAgent?.icon_color || '#000000',
    icon_background: initialAgent?.icon_background || '#F3F4F6',
    tags: initialAgent?.tags || [],
    is_default: initialAgent?.is_default || false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const createAgentMutation = useCreateAgent();
  const updateAgentMutation = useUpdateAgent();
  const queryClient = useQueryClient();

  const validateForm = useCallback(() => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Agent name is required';
    }
    
    if (formData.name && formData.name.length > 100) {
      newErrors.name = 'Agent name must be less than 100 characters';
    }
    
    if (formData.description && formData.description.length > 500) {
      newErrors.description = 'Description must be less than 500 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const updateField = useCallback((field: keyof AgentCreate, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  }, [errors]);

  const submitForm = useCallback(async () => {
    if (!validateForm()) {
      return false;
    }

    setIsSubmitting(true);
    
    try {
      if (initialAgent) {
        // Update existing agent
        await updateAgentMutation.mutateAsync({
          agentId: initialAgent.id,
          ...formData as AgentUpdate,
        });
      } else {
        // Create new agent
        await createAgentMutation.mutateAsync(formData as AgentCreate);
      }
      
      return true;
    } catch (error) {
      console.error('Error submitting agent form:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, validateForm, initialAgent, createAgentMutation, updateAgentMutation]);

  const resetForm = useCallback(() => {
    setFormData({
      name: initialAgent?.name || '',
      description: initialAgent?.description || '',
      system_prompt: '',
      model: null,
      icon_name: initialAgent?.icon_name || 'brain',
      icon_color: initialAgent?.icon_color || '#000000',
      icon_background: initialAgent?.icon_background || '#F3F4F6',
      tags: initialAgent?.tags || [],
      is_default: initialAgent?.is_default || false,
    });
    setErrors({});
  }, [initialAgent]);

  return {
    formData,
    errors,
    isSubmitting,
    updateField,
    submitForm,
    resetForm,
    validateForm,
    isValid: Object.keys(errors).length === 0 && !!formData.name?.trim(),
  };
}
