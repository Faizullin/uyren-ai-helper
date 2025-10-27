'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Database,
  Plus,
  Trash2,
  Edit,
  FolderOpen,
  FileText,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  useProjectVectorStores,
  useCreateVectorStore,
  useUpdateVectorStore,
  useDeleteVectorStore,
} from '@/hooks/use-vector-stores';
import type { VectorStorePublic, VectorStoreCreate, VectorStoreUpdate } from '@/client/types.gen';

export default function VectorStoresPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVectorStore, setSelectedVectorStore] = useState<VectorStorePublic | null>(null);

  const [formData, setFormData] = useState<VectorStoreCreate>({
    name: '',
    description: '',
  });

  const { data: vectorStores, isLoading } = useProjectVectorStores(projectId);
  const createMut = useCreateVectorStore(projectId);
  const updateMut = useUpdateVectorStore();
  const deleteMut = useDeleteVectorStore();

  const handleCreate = async () => {
    await createMut.mutateAsync(formData);
    setIsCreateDialogOpen(false);
    setFormData({ name: '', description: '' });
  };

  const handleEdit = async () => {
    if (!selectedVectorStore) return;

    const updateData: VectorStoreUpdate = {
      name: formData.name,
      description: formData.description,
    };

    await updateMut.mutateAsync({
      vectorStoreId: selectedVectorStore.id,
      data: updateData,
    });

    setIsEditDialogOpen(false);
    setSelectedVectorStore(null);
    setFormData({ name: '', description: '' });
  };

  const handleDelete = async () => {
    if (!selectedVectorStore) return;
    await deleteMut.mutateAsync(selectedVectorStore.id);
    setIsDeleteDialogOpen(false);
    setSelectedVectorStore(null);
  };

  const openEditDialog = (vectorStore: VectorStorePublic) => {
    setSelectedVectorStore(vectorStore);
    setFormData({
      name: vectorStore.name,
      description: vectorStore.description || '',
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (vectorStore: VectorStorePublic) => {
    setSelectedVectorStore(vectorStore);
    setIsDeleteDialogOpen(true);
  };

  const navigateToVectorStore = (vectorStoreId: string) => {
    router.push(`/projects/${projectId}/vector-stores/${vectorStoreId}`);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Vector Stores</h1>
            <p className="text-muted-foreground">Manage vector stores and their content</p>
          </div>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vector Stores</h1>
          <p className="text-muted-foreground">Manage vector stores and their content for semantic search</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Vector Store
        </Button>
      </div>

      {/* Vector Stores Grid */}
      {!vectorStores || vectorStores.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Database className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No vector stores yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first vector store to start managing documents and enable semantic search
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Vector Store
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vectorStores.map((vectorStore) => (
            <Card
              key={vectorStore.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigateToVectorStore(vectorStore.id)}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5" />
                      {vectorStore.name}
                    </CardTitle>
                    {vectorStore.description && (
                      <CardDescription className="mt-2">
                        {vectorStore.description}
                      </CardDescription>
                    )}
                  </div>
                  <Badge variant={vectorStore.status === 'active' ? 'default' : 'secondary'}>
                    {vectorStore.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {/* Stats */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Documents
                    </span>
                    <span className="font-medium">{vectorStore.document_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Chunks
                    </span>
                    <span className="font-medium">{vectorStore.chunk_count}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      Tokens
                    </span>
                    <span className="font-medium">{vectorStore.total_tokens.toLocaleString()}</span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="pt-4 border-t space-y-1">
                  <div className="text-xs text-muted-foreground">
                    Provider: <span className="font-medium text-foreground">{vectorStore.provider}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Created: {new Date(vectorStore.created_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditDialog(vectorStore);
                    }}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDeleteDialog(vectorStore);
                    }}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Vector Store</DialogTitle>
            <DialogDescription>
              Create a new vector store for semantic search and document management
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Vector Store"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Description of your vector store"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!formData.name || createMut.isPending}>
              {createMut.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Vector Store</DialogTitle>
            <DialogDescription>Update vector store details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!formData.name || updateMut.isPending}>
              {updateMut.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Vector Store</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{selectedVectorStore?.name}&quot;? This will
              permanently delete all pages and sections within this vector store. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
            >
              {deleteMut.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

