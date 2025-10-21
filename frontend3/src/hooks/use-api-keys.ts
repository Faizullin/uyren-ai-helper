import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

// TODO: Replace with OpenAPI client when backend adds API keys endpoints
// For now using direct fetch like frontend2

export interface APIKeyResponse {
  key_id: string;
  public_key: string;
  title: string;
  description?: string;
  status: 'active' | 'revoked' | 'expired';
  expires_at?: string;
  last_used_at?: string;
  created_at: string;
}

export interface APIKeyCreateResponse {
  key_id: string;
  public_key: string;
  secret_key: string;
  title: string;
  description?: string;
  status: 'active' | 'revoked' | 'expired';
  expires_at?: string;
  created_at: string;
}

export interface APIKeyCreateRequest {
  title: string;
  description?: string;
  expires_in_days?: number;
}

const getAuthHeaders = async () => {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session?.access_token) {
    throw new Error('No access token available');
  }
  
  return {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
};

export const apiKeysQueryKeys = {
  all: ['api-keys'] as const,
  list: () => [...apiKeysQueryKeys.all, 'list'] as const,
  key: (keyId: string) => [...apiKeysQueryKeys.all, 'key', keyId] as const,
};

export function useAPIKeys() {
  return useQuery({
    queryKey: apiKeysQueryKeys.list(),
    queryFn: async (): Promise<APIKeyResponse[]> => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/v1/api-keys`, { headers });
      
      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }
      
      return await response.json();
    },
  });
}

export function useCreateAPIKey() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: APIKeyCreateRequest): Promise<APIKeyCreateResponse> => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/v1/api-keys`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to create API key');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQueryKeys.all });
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
    mutationFn: async (keyId: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/v1/api-keys/${keyId}/revoke`, {
        method: 'PATCH',
        headers,
      });
      
      if (!response.ok) {
        throw new Error('Failed to revoke API key');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQueryKeys.all });
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
    mutationFn: async (keyId: string) => {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/v1/api-keys/${keyId}`, {
        method: 'DELETE',
        headers,
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }
      
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeysQueryKeys.all });
      toast.success('API key deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete API key');
    },
  });
}

