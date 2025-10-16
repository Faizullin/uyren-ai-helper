import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

export interface Thread {
  thread_id: string;
  account_id: string;
  project_id?: string;
  created_at: string;
  updated_at?: string;
  metadata?: {
    title?: string;
    [key: string]: any;
  };
}

export function useThreads() {
  return useQuery({
    queryKey: ['threads'],
    queryFn: async () => {
      const supabase = createClient();
      
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('threads')
        .select('*')
        .eq('account_id', userData.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Thread[];
    },
  });
}

export function useThread(threadId: string) {
  return useQuery({
    queryKey: ['thread', threadId],
    queryFn: async () => {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('threads')
        .select('*')
        .eq('thread_id', threadId)
        .single();

      if (error) throw error;
      return data as Thread;
    },
    enabled: !!threadId,
  });
}

export function useDeleteThread() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (threadId: string) => {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('threads')
        .delete()
        .eq('thread_id', threadId);

      if (error) throw error;
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
    mutationFn: async ({ threadId, ...updates }: Partial<Thread> & { threadId: string }) => {
      const supabase = createClient();
      
      const { data, error } = await supabase
        .from('threads')
        .update(updates)
        .eq('thread_id', threadId)
        .select()
        .single();

      if (error) throw error;
      return data as Thread;
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

