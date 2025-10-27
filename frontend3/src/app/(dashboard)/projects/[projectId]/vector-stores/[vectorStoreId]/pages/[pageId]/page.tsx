'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, FileText, Plus, Trash2, Edit, Type, Hash, Search, Loader2 } from 'lucide-react';
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
  usePage,
  usePageSections,
  useCreatePageSection,
  useUpdatePageSection,
  useDeletePageSection,
  useSearchVectorStore,
} from '@/hooks/use-vector-stores';
import { toast } from 'sonner';
import type { PageSectionPublic, PageSectionCreate, PageSectionUpdate } from '@/client/types.gen';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function PageDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const vectorStoreId = params.vectorStoreId as string;
  const pageId = params.pageId as string;

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<PageSectionPublic | null>(null);

  const [formData, setFormData] = useState<PageSectionCreate>({
    content: '',
    heading: '',
    slug: '',
  });

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [targetType, setTargetType] = useState('');
  const [targetId, setTargetId] = useState('');
  const [provider, setProvider] = useState('pgvector');

  const { data: page, isLoading: isLoadingPage } = usePage(pageId);
  const { data: sections, isLoading: isLoadingSections } = usePageSections(pageId);
  const createSectionMut = useCreatePageSection(pageId);
  const updateSectionMut = useUpdatePageSection();
  const deleteSectionMut = useDeletePageSection();
  const searchMut = useSearchVectorStore(vectorStoreId);

  const handleCreateSection = async () => {
    await createSectionMut.mutateAsync(formData);
    setIsCreateDialogOpen(false);
    setFormData({ content: '', heading: '', slug: '' });
  };

  const handleEditSection = async () => {
    if (!selectedSection) return;

    const updateData: PageSectionUpdate = {
      content: formData.content,
      heading: formData.heading,
      slug: formData.slug,
    };

    await updateSectionMut.mutateAsync({
      sectionId: selectedSection.id,
      data: updateData,
    });

    setIsEditDialogOpen(false);
    setSelectedSection(null);
    setFormData({ content: '', heading: '', slug: '' });
  };

  const handleDeleteSection = async () => {
    if (!selectedSection) return;
    await deleteSectionMut.mutateAsync(selectedSection.id);
    setIsDeleteDialogOpen(false);
    setSelectedSection(null);
  };

  const openEditDialog = (section: PageSectionPublic) => {
    setSelectedSection(section);
    setFormData({
      content: section.content,
      heading: section.heading || '',
      slug: section.slug || '',
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (section: PageSectionPublic) => {
    setSelectedSection(section);
    setIsDeleteDialogOpen(true);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    await searchMut.mutateAsync({
      query: searchQuery,
      targetType: targetType || undefined,
      targetId: targetId || undefined,
      provider,
    });
  };

  if (isLoadingPage || isLoadingSections) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ))}
          </CardContent>
        </Card>
        
        <div>
          <Skeleton className="h-8 w-32 mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Page Not Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              The page you're looking for doesn't exist
            </p>
            <Button asChild>
              <Link href={`/projects/${projectId}/vector-stores/${vectorStoreId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Vector Store
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
            <Link href={`/projects/${projectId}/vector-stores/${vectorStoreId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{page.path}</h1>
            <div className="flex items-center gap-3 mt-1">
              {page.target_type && <Badge variant="outline">{page.target_type}</Badge>}
              {page.source && (
                <a
                  href={page.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-muted-foreground hover:underline"
                >
                  {page.source}
                </a>
              )}
            </div>
          </div>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Section
        </Button>
      </div>

      {/* Page Info */}
      <Card>
        <CardHeader>
          <CardTitle>Page Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Created:</span>
            <span>{new Date(page.created_at).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Updated:</span>
            <span>{new Date(page.updated_at).toLocaleString()}</span>
          </div>
          {page.last_refresh && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Last Refresh:</span>
              <span>{new Date(page.last_refresh).toLocaleString()}</span>
            </div>
          )}
          {page.checksum && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Checksum:</span>
              <span className="font-mono text-xs">{page.checksum}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sections */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Sections ({sections?.length || 0})</h2>

        {!sections || sections.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Type className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No sections yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Create sections to chunk this page's content for semantic search
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Section
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {sections.map((section, index) => (
              <Card key={section.id} className="hover:shadow-sm transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono text-xs">
                          Section {index + 1}
                        </Badge>
                        {section.heading && (
                          <h3 className="font-medium text-sm truncate">{section.heading}</h3>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {section.token_count} tokens
                        </span>
                        <span>{new Date(section.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(section)}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => openDeleteDialog(section)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {section.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Section Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Section</DialogTitle>
            <DialogDescription>
              Add a new section to chunk this page's content
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="heading">Heading</Label>
              <Input
                id="heading"
                value={formData.heading || ''}
                onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
                placeholder="Section heading"
              />
            </div>
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={formData.slug || ''}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                placeholder="section-slug"
              />
            </div>
            <div>
              <Label htmlFor="content">Content *</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Section content..."
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSection}
              disabled={!formData.content || createSectionMut.isPending}
            >
              {createSectionMut.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Section Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Section</DialogTitle>
            <DialogDescription>Update section details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-heading">Heading</Label>
              <Input
                id="edit-heading"
                value={formData.heading || ''}
                onChange={(e) => setFormData({ ...formData, heading: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-slug">Slug</Label>
              <Input
                id="edit-slug"
                value={formData.slug || ''}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-content">Content *</Label>
              <Textarea
                id="edit-content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={10}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSection}
              disabled={!formData.content || updateSectionMut.isPending}
            >
              {updateSectionMut.isPending ? 'Updating...' : 'Update'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Section Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Section</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this section? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSection}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteSectionMut.isPending}
            >
              {deleteSectionMut.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Semantic Search Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Semantic Search</h2>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Vector Store
            </CardTitle>
            <CardDescription>
              Search through page sections using semantic vector similarity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Form */}
            <div className="grid gap-4">
              {/* Query Input */}
              <div className="space-y-2">
                <Label htmlFor="search-query">Search Query *</Label>
                <Textarea
                  id="search-query"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Enter your search query..."
                  rows={3}
                />
              </div>

              {/* Filters Row */}
              <div className="grid gap-4 md:grid-cols-3">
                {/* Target Type */}
                <div className="space-y-2">
                  <Label htmlFor="target-type">Target Type (Optional)</Label>
                  <Input
                    id="target-type"
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value)}
                    placeholder="e.g., course, lesson"
                  />
                </div>

                {/* Target ID */}
                <div className="space-y-2">
                  <Label htmlFor="target-id">Target ID (Optional)</Label>
                  <Input
                    id="target-id"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="UUID"
                  />
                </div>

                {/* Provider */}
                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pgvector">pgvector (PostgreSQL)</SelectItem>
                      <SelectItem value="faiss">FAISS (In-memory)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {provider === 'pgvector' 
                      ? 'Default, good for small-medium datasets' 
                      : 'Fast for large datasets'}
                  </p>
                </div>
              </div>

              {/* Search Button */}
              <Button
                onClick={handleSearch}
                disabled={searchMut.isPending || !searchQuery.trim()}
                className="w-full"
              >
                {searchMut.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>

            {/* Search Results */}
            {searchMut.isSuccess && searchMut.data && (
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Search Results</h3>
                  <Badge variant="secondary">
                    {searchMut.data.results_count} result(s)
                  </Badge>
                </div>

                {searchMut.data.results_count === 0 ? (
                  <div className="text-center py-8">
                    <Search className="h-12 w-12 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      No results found for your query
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {searchMut.data.results.map((result, index) => (
                      <Card key={result.id} className="border-l-4 border-l-primary">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="default" className="text-xs">
                                  Match {index + 1}
                                </Badge>
                                <Badge variant="outline" className="text-xs font-mono">
                                  {(result.similarity * 100).toFixed(1)}% similar
                                </Badge>
                                {result.heading && (
                                  <span className="text-sm font-medium">{result.heading}</span>
                                )}
                              </div>
                              {result.slug && (
                                <p className="text-xs text-muted-foreground font-mono">{result.slug}</p>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-foreground whitespace-pre-wrap">
                            {result.content}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

