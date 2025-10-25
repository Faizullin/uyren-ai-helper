import { useQuery } from '@tanstack/react-query';
import { KnowledgeBaseService } from '@/client';
import type { KnowledgeBaseEntryPublic, KnowledgeBaseFolderPublic } from '@/client/types.gen';

// Simple file content hook using OpenAPI client
export function useFileContent(sandboxId?: string, filepath?: string) {
  return useQuery({
    queryKey: ['file-content', sandboxId, filepath],
    queryFn: async () => {
      if (!sandboxId || !filepath) return null;
      
      // For now, we'll use the knowledge base service
      // In a real implementation, you'd need to map filepath to entry_id
      // This is a placeholder implementation
      try {
        const response = await KnowledgeBaseService.get_kb_entry_content({
          path: {
            entry_id: filepath // This should be mapped to actual entry ID
          }
        });
        
        if (response.data) {
          return response.data as string;
        }
        return null;
      } catch (error) {
        console.error('Error fetching file content:', error);
        throw error;
      }
    },
    enabled: !!sandboxId && !!filepath,
  });
}

// Simple image content hook using OpenAPI client
export function useImageContent(sandboxId?: string, filepath?: string) {
  return useQuery({
    queryKey: ['image-content', sandboxId, filepath],
    queryFn: async () => {
      if (!sandboxId || !filepath) return null;
      
      try {
        const response = await KnowledgeBaseService.get_kb_entry_content({
          path: {
            entry_id: filepath // This should be mapped to actual entry ID
          }
        });
        
        if (response.data) {
          // Convert the response to a blob URL
          const blob = new Blob([response.data as any], { type: 'image/*' });
          return URL.createObjectURL(blob);
        }
        return null;
      } catch (error) {
        console.error('Error fetching image content:', error);
        throw error;
      }
    },
    enabled: !!sandboxId && !!filepath,
  });
}

// Hook for fetching directory listings using knowledge base folders and entries
export function useDirectoryQuery(
  sandboxId?: string,
  directoryPath?: string,
  options: {
    enabled?: boolean;
    staleTime?: number;
  } = {}
) {
  return useQuery({
    queryKey: ['directory', sandboxId, directoryPath],
    queryFn: async (): Promise<Array<{ name: string; path: string; is_dir: boolean; size: number; mod_time: string; mime_type?: string }>> => {
      if (!sandboxId) {
        throw new Error('Missing sandboxId parameter');
      }
      
      try {
        // First, get all folders to understand the structure
        const foldersResponse = await KnowledgeBaseService.list_kb_folders();
        const folders = foldersResponse.data || [];
        
        // If no specific directory path, return root folders
        if (!directoryPath || directoryPath === '/' || directoryPath === '/workspace') {
          return folders.map(folder => ({
            name: folder.name,
            path: `/workspace/${folder.name}`,
            is_dir: true,
            size: 0,
            mod_time: folder.created_at,
            mime_type: 'folder'
          }));
        }
        
        // Find the folder that matches the directory path
        const folderName = directoryPath.replace('/workspace/', '').replace('/', '');
        const targetFolder = folders.find(folder => folder.name === folderName);
        
        if (!targetFolder) {
          return [];
        }
        
        // Get entries in the target folder
        const entriesResponse = await KnowledgeBaseService.list_folder_entries({
          path: {
            folder_id: targetFolder.id
          }
        });
        
        const entries = entriesResponse.data || [];
        
        // Convert entries to file info format
        return entries.map(entry => ({
          name: entry.filename,
          path: `${directoryPath}/${entry.filename}`,
          is_dir: false,
          size: entry.file_size,
          mod_time: entry.created_at,
          mime_type: entry.mime_type
        }));
        
      } catch (error) {
        console.error('Error fetching directory listing:', error);
        throw error;
      }
    },
    enabled: Boolean(sandboxId && (options.enabled !== false)),
    staleTime: options.staleTime || 30 * 1000, // 30 seconds for directory listings
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
}

// Hook for fetching file content with React Query (compatibility with file-viewer-modal)
export function useFileContentQuery(
  sandboxId?: string,
  filePath?: string,
  options: {
    contentType?: 'text' | 'blob' | 'json';
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
  } = {}
) {
  return useQuery({
    queryKey: ['file-content-query', sandboxId, filePath, options.contentType],
    queryFn: async () => {
      if (!sandboxId || !filePath) {
        throw new Error('Missing required parameters');
      }
      
      try {
        // Extract entry ID from file path (this is a simplified mapping)
        // In a real implementation, you'd need to map filepath to entry_id properly
        const entryId = filePath.split('/').pop() || filePath;
        
        const response = await KnowledgeBaseService.get_kb_entry_content({
          path: {
            entry_id: entryId
          }
        });
        
        if (!response.data) {
          throw new Error('No data received from server');
        }
        
        // Handle content based on type
        switch (options.contentType) {
          case 'json':
            return typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
          case 'blob': {
            const blob = new Blob([response.data as any], { type: 'application/octet-stream' });
            return blob;
          }
          case 'text':
          default:
            return response.data as string;
        }
      } catch (error) {
        console.error('Error fetching file content:', error);
        throw error;
      }
    },
    enabled: Boolean(sandboxId && filePath && (options.enabled !== false)),
    staleTime: options.staleTime || (options.contentType === 'blob' ? 5 * 60 * 1000 : 2 * 60 * 1000),
    gcTime: options.gcTime || 10 * 60 * 1000,
    retry: (failureCount, error: any) => {
      // Don't retry on auth errors
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

// File cache class for compatibility
export class FileCache {
  private cache = new Map<string, any>();
  
  get(key: string) {
    return this.cache.get(key);
  }
  
  set(key: string, value: any) {
    this.cache.set(key, value);
  }
  
  has(key: string) {
    return this.cache.has(key);
  }
  
  delete(key: string) {
    return this.cache.delete(key);
  }
  
  clear() {
    this.cache.clear();
  }
  
  // Utility functions for compatibility
  static getContentTypeFromPath(path: string): 'text' | 'blob' | 'json' {
    if (!path) return 'text';
    
    const ext = path.toLowerCase().split('.').pop() || '';
    
    // Binary file extensions
    if (/^(xlsx|xls|docx|pptx|ppt|pdf|png|jpg|jpeg|gif|bmp|webp|svg|ico|zip|exe|dll|bin|dat|obj|o|so|dylib|mp3|mp4|avi|mov|wmv|flv|wav|ogg)$/.test(ext)) {
      return 'blob';
    }
    
    // JSON files
    if (ext === 'json') return 'json';
    
    // Default to text
    return 'text';
  }
  
  static isImageFile(path: string): boolean {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext);
  }
  
  static isPdfFile(path: string): boolean {
    return path.toLowerCase().endsWith('.pdf');
  }
  
  static getMimeTypeFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    
    switch (ext) {
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xls': return 'application/vnd.ms-excel';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'doc': return 'application/json';
      case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      case 'ppt': return 'application/vnd.ms-powerpoint';
      case 'pdf': return 'application/pdf';
      case 'png': return 'image/png';
      case 'jpg': 
      case 'jpeg': return 'image/jpeg';
      case 'gif': return 'image/gif';
      case 'svg': return 'image/svg+xml';
      case 'zip': return 'application/zip';
      default: return 'application/octet-stream';
    }
  }
}
