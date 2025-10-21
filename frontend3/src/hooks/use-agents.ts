'use client';

import { AgentsService } from '@/client';
import type { AgentCreate, AgentUpdate, ListAgentsData } from '@/client/types.gen';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useAgents(params?: ListAgentsData['query']) {
  return useQuery({
    queryKey: ['agents', params],
    queryFn: async () => {
      const response = await AgentsService.list_agents({
        query: params,
      });
      // The response is wrapped by axios, access the actual data
      return response.data;
    },
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
