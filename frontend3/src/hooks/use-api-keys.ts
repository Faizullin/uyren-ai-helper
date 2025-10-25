import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ApiKeysService } from '@/client';
import type { 
  ApiKeyCreate, 
  ApiKeyGenerateResponse,
  ListApiKeysResponse,
  CreateApiKeyResponse,
  DeleteApiKeyResponse,
  GetApiKeyResponse,
  UpdateApiKeyResponse
} from '@/client/types.gen';

// Re-export types for compatibility
export type APIKeyCreateRequest = ApiKeyCreate;
export type APIKeyCreateResponse = ApiKeyGenerateResponse;
export type APIKeyResponse = ApiKeyGenerateResponse;

export const apiKeysQuery = {
  all: ['api-keys'] as const,
  list: () => [...apiKeysQuery.all, 'list'] as const,
  key: (keyId: string) => [...apiKeysQuery.all, 'key', keyId] as const,
  project: (projectId: string) => [...apiKeysQuery.all, 'project', projectId] as const,
};

export function useAPIKeys() {
  return useQuery({
    queryKey: apiKeysQuery.list(),
    queryFn: async (): Promise<ListApiKeysResponse> => {
      const response = await ApiKeysService.list_api_keys();
      return response.data!;
    },
  });
}

export function useCreateAPIKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: ApiKeyCreate): Promise<CreateApiKeyResponse> => {
      const response = await ApiKeysService.create_api_key({
        body: data,
      });
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQuery.all });
      toast.success('API key created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create API key');
    },
  });
}

export function useRevokeAPIKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (keyId: string): Promise<UpdateApiKeyResponse> => {
      const response = await ApiKeysService.update_api_key({
        path: { api_key_id: keyId },
        body: { status: 'revoked' },
      });
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQuery.all });
      toast.success('API key revoked successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to revoke API key');
    },
  });
}

export function useDeleteAPIKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (keyId: string): Promise<DeleteApiKeyResponse> => {
      const response = await ApiKeysService.delete_api_key({
        path: { api_key_id: keyId },
      });
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQuery.all });
      toast.success('API key deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete API key');
    },
  });
}

export function useAPIKey(keyId: string) {
  return useQuery({
    queryKey: apiKeysQuery.key(keyId),
    queryFn: async (): Promise<GetApiKeyResponse> => {
      const response = await ApiKeysService.get_api_key({
        path: { api_key_id: keyId },
      });
      return response.data!;
    },
    enabled: !!keyId,
  });
}

export function useProjectAPIKeys(projectId: string) {
  return useQuery({
    queryKey: apiKeysQuery.project(projectId),
    queryFn: async () => {
      const response = await ApiKeysService.get_project_api_keys({
        path: { project_id: projectId },
      });
      return response.data!;
    },
    enabled: !!projectId,
  });
}