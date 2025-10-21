import { AgentRunsService, BodyInitiateAgentSession } from '@/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface InitiateAgentResponse {
  thread_id: string;
  agent_run_id: string;
}

export function useInitiateAgentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({data}: {data: BodyInitiateAgentSession}) => {
      const response = await AgentRunsService.initiate_agent_session({
        body: data,
      });
      return response.data as InitiateAgentResponse;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      queryClient.invalidateQueries({ queryKey: ['agent-runs'] });
    },
    onError: (error: any) => {
      if (error?.status === 429) {
        toast.error('Too many agent runs running');
        throw error;
      } else if (error?.status === 402) {
        toast.error('Project limit exceeded');
        throw error;
      } else {
        toast.error('Failed to initiate agent');
        console.error('Error initiating agent:', error);
      }
    },
  });
}

