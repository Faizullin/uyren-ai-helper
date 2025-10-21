import { AgentRunsService } from '@/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function useAgentRunsQuery(threadId: string) {
    return useQuery({
        queryKey: ['agent-runs', threadId],
        queryFn: async () => {
            const response = await AgentRunsService.list_thread_agent_runs({
                path: { thread_id: threadId },
            });
            return response.data;
        },
        enabled: !!threadId,
        retry: 1,
    });
}

export function useStartAgentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            threadId,
            options,
        }: {
            threadId: string;
            options?: {
                model_name?: string;
                agent_id?: string;
            };
        }) => {
            const response = await AgentRunsService.start_agent_run({
                path: { thread_id: threadId },
                body: {
                    model_name: options?.model_name,
                    agent_id: options?.agent_id,
                },
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-agent-runs'] });
        },
        onError: (error: any) => {
            // Handle specific error types
            if (error?.status === 429) {
                toast.error('Too many agent runs running. Please stop some before starting new ones.');
            } else if (error?.status === 402) {
                toast.error('Project limit exceeded. Please upgrade your plan.');
            } else {
                console.error('Error starting agent:', error);
            }
        },
    });
}

export function useStopAgentMutation() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (agentRunId: string) => {
            const response = await AgentRunsService.stop_agent_run({
                path: { agent_run_id: agentRunId },
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['active-agent-runs'] });
            toast.success('Agent stopped successfully');
        },
        onError: (error: any) => {
            toast.error(error.message || 'Failed to stop agent');
        },
    });
}

export function useActiveAgentRunsQuery() {
    return useQuery({
        queryKey: ['active-agent-runs'],
        queryFn: async () => {
            const response = await AgentRunsService.list_active_agent_runs();
            return response.data;
        },
        refetchInterval: 5000, // Refetch every 5 seconds
    });
}

export function useAgentRunStatusQuery(agentRunId: string) {
    return useQuery({
        queryKey: ['agent-run-status', agentRunId],
        queryFn: async () => {
            const response = await AgentRunsService.get_agent_run_status({
                path: { agent_run_id: agentRunId },
            });
            return response.data;
        },
        enabled: !!agentRunId,
        refetchInterval: (query) => {
            // Only refetch if the agent run is still running
            const status = (query.state.data as any)?.status;
            return status === 'running' ? 2000 : false;
        },
    });
}

