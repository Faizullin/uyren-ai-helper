import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EduAiThreadsService, ThreadsService, AgentRunsService } from '@/client';
import { toast } from 'sonner';
import { isActiveStatus } from '@/lib/constants/agent-run-status';

// Query keys
export const threadQueryKeys = {
  all: ['threads'] as const,
  lists: () => [...threadQueryKeys.all, 'list'] as const,
  list: (projectId: string) => [...threadQueryKeys.lists(), projectId] as const,
  details: () => [...threadQueryKeys.all, 'detail'] as const,
  detail: (threadId: string) => [...threadQueryKeys.details(), threadId] as const,
  agentRuns: (threadId: string) => [...threadQueryKeys.detail(threadId), 'agent-runs'] as const,
  agentRunStatus: (runId: string) => [...threadQueryKeys.all, 'agent-run-status', runId] as const,
};

// Hook for listing Edu AI threads
export function useEduAiThreads(projectId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: threadQueryKeys.list(projectId),
    queryFn: async () => {
      const response = await EduAiThreadsService.list_edu_ai_threads({
        query: {
          project_id: projectId,
        }
      });
      return response.data;
    },
    enabled: options?.enabled !== false && !!projectId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

// Hook for getting thread details
export function useThread(threadId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: threadQueryKeys.detail(threadId),
    queryFn: async () => {
      const response = await ThreadsService.get_thread({
        path: { thread_id: threadId }
      });
      return response.data;
    },
    enabled: options?.enabled !== false && !!threadId,
    staleTime: 60 * 1000, // 1 minute
  });
}

// Hook for getting thread messages
export function useThreadMessages(threadId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...threadQueryKeys.detail(threadId), 'messages'] as const,
    queryFn: async () => {
      const response = await ThreadsService.get_thread_messages({
        path: { thread_id: threadId },
        query: { order: 'asc' },
      });
      return response.data?.data || [];
    },
    enabled: options?.enabled !== false && !!threadId,
    staleTime: 10 * 1000, // 10 seconds
  });
}

// Hook for getting thread agent runs
export function useThreadAgentRuns(threadId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: threadQueryKeys.agentRuns(threadId),
    queryFn: async () => {
      const response = await AgentRunsService.list_thread_agent_runs({
        path: { thread_id: threadId },
        query: {
          
        }
      });
      return response.data;
    },
    enabled: options?.enabled !== false && !!threadId,
    staleTime: 10 * 1000, // 10 seconds for real-time updates
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });
}

// Hook for getting agent run status
export function useAgentRunStatus(runId: string, options?: { enabled?: boolean; autoRefresh?: boolean }) {
  return useQuery({
    queryKey: threadQueryKeys.agentRunStatus(runId),
    queryFn: async () => {
      const response = await AgentRunsService.get_agent_run_status({
        path: { agent_run_id: runId }
      });
      return response.data;
    },
    enabled: options?.enabled !== false && !!runId,
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: (query) => {
      // Only auto-refresh if enabled AND run is still active
      if (!options?.autoRefresh) return false;
      const data = query.state.data;
      return data?.status && isActiveStatus(data.status) ? 2000 : false;
    },
  });
}

// Hook for stopping an agent run
export function useStopAgentRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const response = await AgentRunsService.stop_agent_run({
        path: { agent_run_id: runId }
      });
      return response.data;
    },
    onSuccess: (_, runId) => {
      // Invalidate agent run status and thread agent runs
      queryClient.invalidateQueries({ queryKey: threadQueryKeys.agentRunStatus(runId) });
      queryClient.invalidateQueries({ queryKey: threadQueryKeys.all });
      toast.success('Agent run stopped');
    },
    onError: (error: any) => {
      toast.error('Failed to stop agent run');
      console.error('Stop agent run error:', error);
    },
  });
}

export function useRetryAgentRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const response = await AgentRunsService.retry_agent_run({
        path: { agent_run_id: runId },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadQueryKeys.all });
      toast.success('Agent run retried successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to retry agent run');
    },
  });
}

export function useDeleteAgentRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (runId: string) => {
      const response = await AgentRunsService.delete_agent_run({
        path: { agent_run_id: runId },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: threadQueryKeys.all });
      toast.success('Agent run deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete agent run');
    },
  });
}

// Hook for deleting a thread
export function useDeleteThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (threadId: string) => {
      const response = await ThreadsService.delete_thread({
        path: { thread_id: threadId }
      });
      return response.data;
    },
    onSuccess: () => {
      // Invalidate threads lists
      queryClient.invalidateQueries({ queryKey: threadQueryKeys.lists() });
      toast.success('Thread deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete thread');
      console.error('Delete thread error:', error);
    },
  });
}