'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderIcon,
  FileIcon,
  PlusIcon,
  TrashIcon,
  MoreVerticalIcon,
  Upload,
  Loader2,
  Download,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  useKnowledgeFolders,
  useCreateFolder,
  useDeleteFolder,
  useFolderEntries,
  useDeleteEntry,
} from '@/hooks/use-knowledge-base';
import type { KnowledgeBaseFolderPublic, KnowledgeBaseEntryPublic } from '@/client/types.gen';
import { createClient } from '@/lib/supabase/client';
import { NewFolderDialog } from '@/components/knowledge-base/new-folder-dialog';
import { UploadFilesDialog } from '@/components/knowledge-base/upload-files-dialog';
import { DeleteConfirmDialog } from '@/components/knowledge-base/delete-confirm-dialog'

interface KnowledgeBaseManagerProps {
  agentId?: string;
  agentName?: string;
  showHeader?: boolean;
  headerTitle?: string;
  headerDescription?: string;
  showRecentFiles?: boolean;
  emptyStateMessage?: string;
  emptyStateContent?: React.ReactNode;
  maxHeight?: string;
  enableAssignments?: boolean;
}

export function KnowledgeBaseManager({
  agentId,
  agentName,
  showHeader = true,
  headerTitle = "Knowledge Base",
  headerDescription = "Organize documents and files for AI agents to search and reference",
  showRecentFiles = true,
  emptyStateMessage,
  emptyStateContent,
  maxHeight,
  enableAssignments = false,
}: KnowledgeBaseManagerProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    item: { id: string; name: string; type: 'folder' | 'file' } | null;
  }>({ isOpen: false, item: null });

  const { data: folders, isLoading: foldersLoading } = useKnowledgeFolders();
  const createFolderMutation = useCreateFolder();
  const deleteFolderMutation = useDeleteFolder();
  const deleteEntryMutation = useDeleteEntry();

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleCreateFolder = async (name: string, description?: string) => {
    await createFolderMutation.mutateAsync({ name, description });
    setNewFolderDialogOpen(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.item) return;

    try {
      if (deleteDialog.item.type === 'folder') {
        await deleteFolderMutation.mutateAsync(deleteDialog.item.id);
      } else {
        await deleteEntryMutation.mutateAsync(deleteDialog.item.id);
      }
      setDeleteDialog({ isOpen: false, item: null });
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleUploadClick = (folderId: string) => {
    setSelectedFolderId(folderId);
    setUploadDialogOpen(true);
  };

  const handleDownloadEntry = async (entryId: string, filename: string) => {
    try {
      // Backend returns file as StreamingResponse, need to fetch as blob
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('Not authenticated');
        return;
      }

      const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
      const response = await fetch(`${API_URL}/api/v1/knowledge-base/entries/${entryId}/download`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download file');
      }

      // Get the blob from response
      const blob = await response.blob();
      
      // Create a temporary URL and trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Downloaded ${filename}`);
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error(error.message || 'Failed to download file');
    }
  };

  if (foldersLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  const hasFolders = folders && folders.length > 0;

  return (
    <div className="space-y-4">
      {showHeader && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{headerTitle}</CardTitle>
                <CardDescription>{headerDescription}</CardDescription>
              </div>
              <Button onClick={() => setNewFolderDialogOpen(true)}>
                <PlusIcon className="h-4 w-4 mr-2" />
                New Folder
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {!hasFolders ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FolderIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {emptyStateMessage || 'No folders yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                Create a folder to start organizing your knowledge base
              </p>
              {emptyStateContent || (
                <Button onClick={() => setNewFolderDialogOpen(true)}>
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Folder
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              isExpanded={expandedFolders.has(folder.id)}
              onToggle={() => toggleFolder(folder.id)}
              onUpload={() => handleUploadClick(folder.id)}
              onDelete={() =>
                setDeleteDialog({
                  isOpen: true,
                  item: { id: folder.id, name: folder.name, type: 'folder' },
                })
              }
              onDeleteEntry={(entryId, filename) =>
                setDeleteDialog({
                  isOpen: true,
                  item: { id: entryId, name: filename, type: 'file' },
                })
              }
              onDownloadEntry={handleDownloadEntry}
            />
          ))}
        </div>
      )}

      <NewFolderDialog
        open={newFolderDialogOpen}
        onOpenChange={setNewFolderDialogOpen}
        onSubmit={handleCreateFolder}
        isLoading={createFolderMutation.isPending}
      />

      <UploadFilesDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        folderId={selectedFolderId}
      />

      <DeleteConfirmDialog
        open={deleteDialog.isOpen}
        onOpenChange={(open: boolean) => setDeleteDialog({ ...deleteDialog, isOpen: open })}
        onConfirm={handleDeleteConfirm}
        itemName={deleteDialog.item?.name || ''}
        itemType={deleteDialog.item?.type || 'file'}
        isDeleting={deleteFolderMutation.isPending || deleteEntryMutation.isPending}
      />
    </div>
  );
}

interface FolderCardProps {
  folder: KnowledgeBaseFolderPublic;
  isExpanded: boolean;
  onToggle: () => void;
  onUpload: () => void;
  onDelete: () => void;
  onDeleteEntry: (entryId: string, filename: string) => void;
  onDownloadEntry: (entryId: string, filename: string) => void;
}

function FolderCard({
  folder,
  isExpanded,
  onToggle,
  onUpload,
  onDelete,
  onDeleteEntry,
  onDownloadEntry,
}: FolderCardProps) {
  const { data: entries, isLoading: entriesLoading } = useFolderEntries(
    isExpanded ? folder.id : ''
  );

  return (
    <Card>
      <CardHeader className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={onToggle}>
            <FolderIcon className="h-5 w-5 text-primary" />
            <div>
              <h4 className="font-semibold">{folder.name}</h4>
              {folder.description && (
                <p className="text-sm text-muted-foreground">{folder.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {folder.entry_count} file{folder.entry_count !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onUpload}>
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVerticalIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <TrashIcon className="h-4 w-4 mr-2" />
                  Delete Folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {entriesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading files...
            </div>
          ) : entries && entries.length > 0 ? (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{entry.filename}</p>
                      <p className="text-xs text-muted-foreground truncate">{entry.summary}</p>
                      <p className="text-xs text-muted-foreground">
                        {(entry.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDownloadEntry(entry.id, entry.filename)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download file</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDeleteEntry(entry.id, entry.filename)}
                        >
                          <TrashIcon className="h-4 w-4 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete file</TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No files in this folder yet
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

