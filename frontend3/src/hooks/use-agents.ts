import { AgentsService } from '@/client';
import type { AgentCreate, AgentUpdate } from '@/client/types.gen';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';


export interface Agent {
  agent_id: string;
  name: string;
  description?: string;
  system_prompt?: string;
  model?: string;
  created_at: string;
  updated_at?: string;
  account_id: string;
  is_default?: boolean;
  is_public?: boolean;
  tags?: string[];
  icon_name?: string;
  icon_color?: string;
  icon_background?: string;
  configured_mcps?: any[];
  agentpress_tools?: Record<string, any>;
}

export interface AgentsListParams {
  skip?: number;
  limit?: number;
  search?: string;
  is_default?: boolean;
  is_public?: boolean;
}

export function useAgents(params?: AgentsListParams) {
  return useQuery({
    queryKey: ['agents', params],
    queryFn: async () => {
      const response = await AgentsService.getAgents({
        skip: params?.skip,
        limit: params?.limit,
        search: params?.search,
        isDefault: params?.is_default,
        isPublic: params?.is_public,
      });

      // The response is typed as { [key: string]: unknown }
      // but we know it returns an array or an object with agents array
      if (Array.isArray(response)) {
        return response as Agent[];
      }

      // If it's an object with agents array
      if (response && typeof response === 'object' && 'agents' in response) {
        return (response as any).agents as Agent[];
      }

      return response as Agent[];
    },
  });
}

export function useAgent(agentId: string) {
  return useQuery({
    queryKey: ['agents', agentId],
    queryFn: async () => {
      const response = await AgentsService.getAgent({ agentId });
      return response as Agent;
    },
    enabled: !!agentId,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agent: AgentCreate) => {
      const response = await AgentsService.createAgent({
        requestBody: agent,
      });
      return response as Agent;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent created successfully');
      return data;
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create agent');
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, ...updates }: AgentUpdate & { agentId: string }) => {
      const response = await AgentsService.updateAgent({
        agentId,
        requestBody: updates as AgentUpdate,
      });
      return response as Agent;
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['agents', variables.agentId], data);
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
    mutationFn: async (agentId: string) => {
      await AgentsService.deleteAgent({ agentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete agent');
    },
  });
}
