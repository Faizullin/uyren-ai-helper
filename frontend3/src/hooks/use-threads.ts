import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ThreadsService } from '@/client';
import type { ThreadPublic, ThreadUpdate } from '@/client/types.gen';

export function useThreads(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: ['threads', params],
    queryFn: async (): Promise<ThreadPublic[]> => {
      const response = await ThreadsService.list_user_threads({
        query: params,
      });
      return response.data?.data || [];
    },
  });
}

export function useThread(threadId: string) {
  return useQuery({
    queryKey: ['thread', threadId],
    queryFn: async (): Promise<ThreadPublic> => {
      const response = await ThreadsService.get_thread({
        path: { thread_id: threadId },
      });
      return response.data!;
    },
    enabled: !!threadId,
  });
}

export function useDeleteThread() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (threadId: string) => {
      const response = await ThreadsService.delete_thread({
        path: { thread_id: threadId },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      toast.success('Thread deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete thread');
    },
  });
}

export function useUpdateThread() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ threadId, ...updates }: ThreadUpdate & { threadId: string }) => {
      const response = await ThreadsService.update_thread({
        path: { thread_id: threadId },
        body: updates as ThreadUpdate,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      toast.success('Thread updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update thread');
    },
  });
}

