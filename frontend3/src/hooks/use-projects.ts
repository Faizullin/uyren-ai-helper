import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ProjectsService } from '@/client';
import type { ProjectPublic, ProjectCreate, ProjectUpdate, Thread, PaginatedResponseProjectPublic, PaginatedResponseThread } from '@/client/types.gen';

export function useProjects(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: async (): Promise<PaginatedResponseProjectPublic> => {
      const response = await ProjectsService.list_user_projects({
        query: params,
      });
      return response.data!;
    },
  });
}

export function useProject(projectId: string) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async (): Promise<ProjectPublic> => {
      const response = await ProjectsService.get_project({
        path: { project_id: projectId },
      });
      return response.data!;
    },
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (project: ProjectCreate) => {
      const response = await ProjectsService.create_project({
        body: project,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create project');
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ projectId, ...updates }: ProjectUpdate & { projectId: string }) => {
      const response = await ProjectsService.update_project({
        path: { project_id: projectId },
        body: updates as ProjectUpdate,
      });
      return response.data;
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast.success('Project updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update project');
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (projectId: string) => {
      const response = await ProjectsService.delete_project({
        path: { project_id: projectId },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Project deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete project');
    },
  });
}

export function useProjectThreads(projectId: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['project-threads', projectId, params],
    queryFn: async (): Promise<PaginatedResponseThread> => {
      const response = await ProjectsService.get_project_threads({
        path: { project_id: projectId },
        query: params,
      });
      return response.data!;
    },
    enabled: !!projectId,
  });
}
