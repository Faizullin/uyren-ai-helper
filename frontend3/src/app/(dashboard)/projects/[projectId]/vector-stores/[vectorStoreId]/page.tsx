'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Plus, Trash2, Edit, Database, Link as LinkIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useVectorStore,
  useVectorStorePages,
  useCreatePage,
  useDeletePage,
  useImportKBFile,
} from '@/hooks/use-vector-stores';
import { useKnowledgeFolders, useFolderEntries } from '@/hooks/use-knowledge-base';
import { useDialogControl } from '@/hooks/use-dialog-control';
import type { PagePublic, PageCreate, KnowledgeBaseEntryPublic } from '@/client/types.gen';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function VectorStoreDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const vectorStoreId = params.vectorStoreId as string;

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PagePublic | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [selectedKbEntryId, setSelectedKbEntryId] = useState<string>('');
  
  const importDialog = useDialogControl();

  const [formData, setFormData] = useState<PageCreate>({
    path: '',
    content: '',
    meta: {},
    target_type: null,
    target_id: null,
    source: null,
    parent_page_id: null,
  });

  const { data: vectorStore, isLoading: isLoadingStore } = useVectorStore(vectorStoreId);
  const { data: pages, isLoading: isLoadingPages } = useVectorStorePages(vectorStoreId);
  const { data: folders, isLoading: isLoadingFolders } = useKnowledgeFolders();
  const { data: kbEntries, isLoading: isLoadingEntries } = useFolderEntries(selectedFolderId);
  const createPageMut = useCreatePage(vectorStoreId);
  const deletePageMut = useDeletePage();
  const importKbFileMut = useImportKBFile(vectorStoreId);

  const handleCreatePage = async () => {
    await createPageMut.mutateAsync(formData);
    setIsCreateDialogOpen(false);
    setFormData({
      path: '',
      content: '',
      meta: {},
      target_type: null,
      target_id: null,
      source: null,
      parent_page_id: null,
    });
  };

  const handleDeletePage = async () => {
    if (!selectedPage) return;
    await deletePageMut.mutateAsync(selectedPage.id);
    setIsDeleteDialogOpen(false);
    setSelectedPage(null);
  };

  const handleImportKBFile = async () => {
    if (!selectedKbEntryId) return;
    
    await importKbFileMut.mutateAsync({
      kbEntryId: selectedKbEntryId,
    });
    
    setSelectedKbEntryId('');
    setSelectedFolderId('');
    importDialog.hide();
  };

  const openDeleteDialog = (page: PagePublic) => {
    setSelectedPage(page);
    setIsDeleteDialogOpen(true);
  };

  const navigateToPage = (pageId: string) => {
    router.push(`/projects/${projectId}/vector-stores/${vectorStoreId}/pages/${pageId}`);
  };

  if (isLoadingStore || isLoadingPages) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div>
          <Skeleton className="h-8 w-32 mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!vectorStore) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Vector Store Not Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              The vector store you're looking for doesn't exist
            </p>
            <Button asChild>
              <Link href={`/projects/${projectId}/vector-stores`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Vector Stores
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/projects/${projectId}/vector-stores`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{vectorStore.name}</h1>
              <Badge variant={vectorStore.status === 'active' ? 'default' : 'secondary'}>
                {vectorStore.status}
              </Badge>
            </div>
            {vectorStore.description && (
              <p className="text-muted-foreground">{vectorStore.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={importDialog.show}>
            <Download className="h-4 w-4 mr-2" />
            Import KB File
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Page
          </Button>
        </div>
      </div>

      {/* Vector Store Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vectorStore.document_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Chunks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vectorStore.chunk_count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tokens</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vectorStore.total_tokens.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{vectorStore.provider}</div>
          </CardContent>
        </Card>
      </div>

      {/* Pages Section */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Pages</h2>

        {!pages || pages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pages yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create your first page to add content to this vector store
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Page
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pages.map((page) => (
              <Card
                key={page.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigateToPage(page.id)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {page.path}
                      </CardTitle>
                      <CardDescription className="mt-2 flex items-center gap-4">
                        {page.source && (
                          <span className="flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" />
                            {page.source}
                          </span>
                        )}
                        {page.target_type && (
                          <Badge variant="outline">{page.target_type}</Badge>
                        )}
                        <span className="text-xs">
                          Created: {new Date(page.created_at).toLocaleDateString()}
                        </span>
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteDialog(page);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Page Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Page</DialogTitle>
            <DialogDescription>
              Add a new page to this vector store
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="path">Path *</Label>
              <Input
                id="path"
                value={formData.path}
                onChange={(e) => setFormData({ ...formData, path: e.target.value })}
                placeholder="/docs/getting-started"
              />
            </div>
            <div>
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content || ''}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Page content..."
                rows={6}
              />
            </div>
            <div>
              <Label htmlFor="source">Source URL</Label>
              <Input
                id="source"
                value={formData.source || ''}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                placeholder="https://example.com/docs/page"
              />
            </div>
            <div>
              <Label htmlFor="target_type">Target Type</Label>
              <Input
                id="target_type"
                value={formData.target_type || ''}
                onChange={(e) => setFormData({ ...formData, target_type: e.target.value })}
                placeholder="e.g., documentation, blog, api"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePage} disabled={!formData.path || createPageMut.isPending}>
              {createPageMut.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Page Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Page</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedPage?.path}&quot;? This will
              permanently delete all sections within this page. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeletePage}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePageMut.isPending}
            >
              {deletePageMut.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import KB File Dialog */}
      <Dialog open={importDialog.isVisible} onOpenChange={(open) => !open && importDialog.hide()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Knowledge Base File</DialogTitle>
            <DialogDescription>
              Select a file from your knowledge base to import into this vector store for RAG processing
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2 text-sm">
                What happens when you import:
              </h4>
              <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                <li>File is downloaded from Knowledge Base</li>
                <li>Content is extracted and processed</li>
                <li>Pages and sections are created</li>
                <li>Vector embeddings are generated for RAG</li>
              </ol>
            </div>

            {/* Folder Selection */}
            <div className="space-y-2">
              <Label>Select Folder</Label>
              {isLoadingFolders ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading folders...
                </div>
              ) : !folders || folders.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-4">
                    No knowledge base folders found.
                  </p>
                  <Button variant="outline" asChild>
                    <Link href="/knowledge">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Folder
                    </Link>
                  </Button>
                </div>
              ) : (
                <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a folder..." />
                  </SelectTrigger>
                  <SelectContent>
                    {folders.map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>
                        {folder.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* File Selection */}
            {selectedFolderId && (
              <div className="space-y-2">
                <Label>Select File</Label>
                {isLoadingEntries ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading files...
                  </div>
                ) : !kbEntries || kbEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    No files in this folder. Upload files to the folder first.
                  </p>
                ) : (
                  <>
                    <Select value={selectedKbEntryId} onValueChange={setSelectedKbEntryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a file..." />
                      </SelectTrigger>
                      <SelectContent>
                        {kbEntries.map((entry: KnowledgeBaseEntryPublic) => (
                          <SelectItem key={entry.id} value={entry.id}>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              <span>{entry.filename}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {kbEntries.length} file(s) in this folder
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={importDialog.hide}>
              Cancel
            </Button>
            <Button
              onClick={handleImportKBFile}
              disabled={importKbFileMut.isPending || !selectedKbEntryId}
            >
              {importKbFileMut.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Import File
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

