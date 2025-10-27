import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { VectorStoreService } from '@/client';
import type {
  VectorStorePublic,
  VectorStoreCreate,
  VectorStoreUpdate,
  PagePublic,
  PageCreate,
  PageUpdate,
  PageSectionPublic,
  PageSectionCreate,
  PageSectionUpdate,
} from '@/client/types.gen';

// ==================== Query Keys ====================

export const vectorStoreKeys = {
  all: ['vector-stores'] as const,
  byProject: (projectId: string) => ['vector-stores', 'project', projectId] as const,
  detail: (vectorStoreId: string) => ['vector-store', vectorStoreId] as const,
  pages: (vectorStoreId: string) => ['vector-store', vectorStoreId, 'pages'] as const,
  page: (pageId: string) => ['page', pageId] as const,
  sections: (pageId: string) => ['page', pageId, 'sections'] as const,
};

// ==================== VectorStore Hooks ====================

export function useProjectVectorStores(projectId: string) {
  return useQuery({
    queryKey: vectorStoreKeys.byProject(projectId),
    queryFn: async (): Promise<VectorStorePublic[]> => {
      const response = await VectorStoreService.list_project_vector_stores({
        path: { project_id: projectId },
      });
      return response.data?.data || [];
    },
    enabled: !!projectId,
  });
}

export function useVectorStore(vectorStoreId: string) {
  return useQuery({
    queryKey: vectorStoreKeys.detail(vectorStoreId),
    queryFn: async (): Promise<VectorStorePublic> => {
      const response = await VectorStoreService.get_vector_store({
        path: { vector_store_id: vectorStoreId },
      });
      return response.data!;
    },
    enabled: !!vectorStoreId,
  });
}

export function useCreateVectorStore(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: VectorStoreCreate) => {
      const response = await VectorStoreService.create_vector_store({
        path: { project_id: projectId },
        body: data,
      });
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.byProject(projectId) });
      toast.success('Vector store created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create vector store');
    },
  });
}

export function useUpdateVectorStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ vectorStoreId, data }: { vectorStoreId: string; data: VectorStoreUpdate }) => {
      const response = await VectorStoreService.update_vector_store({
        path: { vector_store_id: vectorStoreId },
        body: data,
      });
      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.byProject(data.project_id!) });
      toast.success('Vector store updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update vector store');
    },
  });
}

export function useDeleteVectorStore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vectorStoreId: string) => {
      const response = await VectorStoreService.delete_vector_store({
        path: { vector_store_id: vectorStoreId },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.all });
      toast.success('Vector store deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete vector store');
    },
  });
}

// ==================== Page Hooks ====================

export function useVectorStorePages(vectorStoreId: string) {
  return useQuery({
    queryKey: vectorStoreKeys.pages(vectorStoreId),
    queryFn: async (): Promise<PagePublic[]> => {
      const response = await VectorStoreService.list_pages({
        path: { vector_store_id: vectorStoreId },
      });
      return response.data?.data || [];
    },
    enabled: !!vectorStoreId,
  });
}

export function usePage(pageId: string) {
  return useQuery({
    queryKey: vectorStoreKeys.page(pageId),
    queryFn: async (): Promise<PagePublic> => {
      const response = await VectorStoreService.get_page({
        path: { page_id: pageId },
      });
      return response.data!;
    },
    enabled: !!pageId,
  });
}

export function useCreatePage(vectorStoreId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PageCreate) => {
      const response = await VectorStoreService.create_page({
        path: { vector_store_id: vectorStoreId },
        body: data,
      });
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.pages(vectorStoreId) });
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.detail(vectorStoreId) });
      toast.success('Page created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create page');
    },
  });
}

export function useUpdatePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ pageId, data }: { pageId: string; data: PageUpdate }) => {
      const response = await VectorStoreService.update_page({
        path: { page_id: pageId },
        body: data,
      });
      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.page(data.id) });
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.pages(data.vector_store_id) });
      toast.success('Page updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update page');
    },
  });
}

export function useDeletePage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pageId: string) => {
      const response = await VectorStoreService.delete_page({
        path: { page_id: pageId },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.all });
      toast.success('Page deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete page');
    },
  });
}

// ==================== PageSection Hooks ====================

export function usePageSections(pageId: string) {
  return useQuery({
    queryKey: vectorStoreKeys.sections(pageId),
    queryFn: async (): Promise<PageSectionPublic[]> => {
      const response = await VectorStoreService.list_page_sections({
        path: { page_id: pageId },
      });
      return response.data || [];
    },
    enabled: !!pageId,
  });
}

export function useCreatePageSection(pageId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PageSectionCreate) => {
      const response = await VectorStoreService.create_page_section({
        path: { page_id: pageId },
        body: data,
      });
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.sections(pageId) });
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.page(pageId) });
      toast.success('Section created successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create section');
    },
  });
}

export function useUpdatePageSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sectionId, data }: { sectionId: string; data: PageSectionUpdate }) => {
      const response = await VectorStoreService.update_page_section({
        path: { section_id: sectionId },
        body: data,
      });
      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.sections(data.page_id) });
      toast.success('Section updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update section');
    },
  });
}

export function useDeletePageSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sectionId: string) => {
      const response = await VectorStoreService.delete_page_section({
        path: { section_id: sectionId },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.all });
      toast.success('Section deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to delete section');
    },
  });
}

// ==================== Knowledge Base Integration ====================

export function useImportKBFile(vectorStoreId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ kbEntryId, targetType, targetId }: { 
      kbEntryId: string; 
      targetType?: string;
      targetId?: string;
    }) => {
      const response = await VectorStoreService.add_kb_file_to_vector_store({
        path: { vector_store_id: vectorStoreId },
        query: { 
          kb_entry_id: kbEntryId,
          target_type: targetType,
          target_id: targetId,
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.pages(vectorStoreId) });
      queryClient.invalidateQueries({ queryKey: vectorStoreKeys.detail(vectorStoreId) });
      toast.success('Knowledge base file imported successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to import knowledge base file');
    },
  });
}

// ==================== Vector Search ====================

export function useSearchVectorStore(vectorStoreId: string) {
  return useMutation({
    mutationFn: async ({ query, targetType, targetId, provider }: { 
      query: string; 
      targetType?: string;
      targetId?: string;
      provider?: string;
    }) => {
      const response = await VectorStoreService.search_page_sections({
        path: { vector_store_id: vectorStoreId },
        query: { provider: provider || 'pgvector' },
        body: {
          query,
          top_k: 5,
          similarity_threshold: 0.1,
          target_type: targetType || null,
          target_id: targetId || null,
        },
      });
      return response.data;
    },
    onError: (error: any) => {
      toast.error(error.message || 'Search failed');
    },
  });
}

