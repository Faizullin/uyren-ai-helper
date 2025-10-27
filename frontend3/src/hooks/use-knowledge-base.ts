import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { KnowledgeBaseService } from '@/client';
import type {
  KnowledgeBaseFolderPublic,
  KnowledgeBaseFolderCreate,
  KnowledgeBaseFolderUpdate,
  KnowledgeBaseEntryPublic,
  KnowledgeBaseEntryUpdate,
  KnowledgeBaseStats,
} from '@/client/types.gen';

// Knowledge Base Query Keys
export const knowledgeBaseKeys = {
  all: ['knowledge-base'] as const,
  folders: () => [...knowledgeBaseKeys.all, 'folders'] as const,
  folder: (folderId: string) => [...knowledgeBaseKeys.folders(), folderId] as const,
  folderEntries: (folderId: string) => [...knowledgeBaseKeys.folder(folderId), 'entries'] as const,
  entry: (entryId: string) => [...knowledgeBaseKeys.all, 'entry', entryId] as const,
  agentAssignments: (agentId: string) => [...knowledgeBaseKeys.all, 'agent-assignments', agentId] as const,
  stats: () => [...knowledgeBaseKeys.all, 'stats'] as const,
};

// Folders
export function useKnowledgeFolders() {
  return useQuery({
    queryKey: knowledgeBaseKeys.folders(),
    queryFn: async (): Promise<KnowledgeBaseFolderPublic[]> => {
      const response = await KnowledgeBaseService.list_kb_folders();
      return response.data || [];
    },
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: KnowledgeBaseFolderCreate) => {
      const response = await KnowledgeBaseService.create_kb_folder({
        body: data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.folders() });
      toast.success('Folder created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create folder');
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ folderId, data }: { folderId: string; data: KnowledgeBaseFolderUpdate }) => {
      const response = await KnowledgeBaseService.update_kb_folder({
        path: { folder_id: folderId },
        body: data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.folders() });
      toast.success('Folder updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update folder');
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (folderId: string) => {
      const response = await KnowledgeBaseService.delete_kb_folder({
        path: { folder_id: folderId },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.folders() });
      toast.success('Folder deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete folder');
    },
  });
}

// Entries
export function useFolderEntries(folderId: string) {
  return useQuery({
    queryKey: knowledgeBaseKeys.folderEntries(folderId),
    queryFn: async (): Promise<KnowledgeBaseEntryPublic[]> => {
      const response = await KnowledgeBaseService.list_folder_entries({
        path: { folder_id: folderId },
      });
      return response.data || [];
    },
    enabled: !!folderId,
  });
}

export function useUploadFiles() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ folderId, files }: { folderId: string; files: File[] }) => {
      const response = await KnowledgeBaseService.upload_file_to_folder({
        path: { folder_id: folderId },
        body: { file: files as any },
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.folderEntries(variables.folderId) });
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.folders() });
      toast.success('Files uploaded successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to upload files');
    },
  });
}

export function useDeleteEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (entryId: string) => {
      const response = await KnowledgeBaseService.delete_kb_entry({
        path: { entry_id: entryId },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all });
      toast.success('File deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete file');
    },
  });
}

export function useUpdateEntry() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ entryId, data }: { entryId: string; data: KnowledgeBaseEntryUpdate }) => {
      const response = await KnowledgeBaseService.update_kb_entry({
        path: { entry_id: entryId },
        body: data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.all });
      toast.success('Entry updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update entry');
    },
  });
}

// Agent Assignments
export function useAgentAssignments(agentId: string) {
  return useQuery({
    queryKey: knowledgeBaseKeys.agentAssignments(agentId),
    queryFn: async (): Promise<Record<string, boolean>> => {
      const response = await KnowledgeBaseService.get_agent_kb_assignments({
        path: { agent_id: agentId },
      });
      return response.data as Record<string, boolean>;
    },
    enabled: !!agentId,
  });
}

export function useUpdateAgentAssignments() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ agentId, entryIds }: { agentId: string; entryIds: string[] }) => {
      const response = await KnowledgeBaseService.update_agent_kb_assignments({
        path: { agent_id: agentId },
        body: { entry_ids: entryIds },
      });
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: knowledgeBaseKeys.agentAssignments(variables.agentId) });
      toast.success('Knowledge base access updated');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update assignments');
    },
  });
}

// Stats
export function useKnowledgeBaseStats() {
  return useQuery({
    queryKey: knowledgeBaseKeys.stats(),
    queryFn: async () => {
      const response = await KnowledgeBaseService.get_kb_stats();
      return response.data;
    },
  });
}

