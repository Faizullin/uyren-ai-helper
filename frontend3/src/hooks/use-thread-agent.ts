import { useQuery } from '@tanstack/react-query';
import { AgentsService } from '@/client';

export function useThreadAgent(threadId: string) {
  return useQuery({
    queryKey: ['thread-agent', threadId],
    queryFn: async () => {
      // This would typically fetch the agent associated with a thread
      // For now, return null as placeholder
      return null;
    },
    enabled: !!threadId,
  });
}
