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
      return response.data!;
    },
    onSuccess: (data: AgentStartResponse) => {
      // Invalidate relevant queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      queryClient.invalidateQueries({ queryKey: ['agent-runs'] });

      toast.success('Demo task started successfully!');

      // Navigate directly to the agent run detail page to see live logs
      if (data.agent_run_id && data.thread_id && data.project_id) {
        router.push(`/projects/${data.project_id}/threads/${data.thread_id}/runs/${data.agent_run_id}`);
      }
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Failed to start demo task';
      toast.error(errorMessage);
    },
  });
}
