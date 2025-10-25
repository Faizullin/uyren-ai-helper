import { DemoTasksService } from '@/client';
import type { AgentStartResponse } from '@/client/types.gen';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function useStartDemoTask() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      projectId,
      taskName = 'demo_processing'
    }: {
      projectId: string;
      taskName?: string;
    }): Promise<AgentStartResponse> => {
      const response = await DemoTasksService.start_demo_educational_task({
        query: {
          project_id: projectId,
          task_name: taskName,
        },
      });
      
      if (!response.data) {
        throw new Error('No data received from server');
      }
      
      return response.data;
    },
    onSuccess: (data: AgentStartResponse) => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      queryClient.invalidateQueries({ queryKey: ['agent-runs'] });

      const message = `Demo task started successfully! Agent Run ID: ${data.agent_run_id}`;
      toast.success(message);

      // Navigate to the created thread
      if (data.thread_id) {
        if (data.project_id) {
          router.push(`/projects/${data.project_id}/threads/${data.thread_id}`);
        } else {
          router.push(`/agents/threads/${data.thread_id}`);
        }
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to start demo task';
      toast.error(errorMessage);
    },
  });
}
