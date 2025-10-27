'use client';

import React, { useState } from 'react';
import { useProject, useProjectThreads } from '@/hooks/use-projects';
import { useDeleteThread } from '@/hooks/use-threads';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  ArrowLeft,
  Search,
  Calendar,
  MessageSquare,
  Plus,
  FolderOpen,
  Trash2
} from 'lucide-react';
import Link from 'next/link';

interface ProjectThreadsContentProps {
  projectId: string;
}

export function ProjectThreadsContent({ projectId }: ProjectThreadsContentProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [threadToDelete, setThreadToDelete] = useState<string | null>(null);

  const projectQuery = useProject(projectId);
  const threadsQuery = useProjectThreads(projectId);
  const deleteThreadMutation = useDeleteThread();

  const filteredThreads = threadsQuery.data?.data?.filter(thread =>
    thread.id && (
      thread.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.description?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  const handleDeleteThread = async () => {
    if (!threadToDelete) return;
    
    try {
      await deleteThreadMutation.mutateAsync(threadToDelete);
      setThreadToDelete(null);
    } catch (error) {
      console.error('Failed to delete thread:', error);
    }
  };

  if (projectQuery.isLoading || threadsQuery.isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Skeleton className="h-10 flex-1 max-w-sm" />
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

  if (projectQuery.error || !projectQuery.data) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderOpen className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Project not found</h3>
            <p className="text-muted-foreground text-center mb-4">
              The project you're looking for doesn't exist or you don't have access to it.
            </p>
            <Button asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Projects
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const project = projectQuery.data;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/projects/${projectId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Project
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{project.name} - Threads</h1>
            <p className="text-muted-foreground">All conversations in this project</p>
          </div>
        </div>
        
        <Button asChild>
          <Link href={`/projects/${projectId}/threads/new`}>
            <Plus className="h-4 w-4 mr-2" />
            New Thread
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search threads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Threads Grid */}
      {filteredThreads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No threads found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {searchTerm ? 'No threads match your search criteria.' : 'This project doesn\'t have any threads yet.'}
            </p>
            {!searchTerm && (
              <Button asChild>
                <Link href={`/projects/${projectId}/threads/new`}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Thread
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredThreads.map((thread) => (
            <Card key={thread.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg flex-1">
                    <Link 
                      href={`/projects/${projectId}/threads/${thread.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {thread.title}
                    </Link>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.preventDefault();
                      if (thread.id) {
                        setThreadToDelete(thread.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardDescription className="mt-1">
                  {thread.description || 'No description'}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center space-x-1">
                    <Calendar className="h-4 w-4" />
                    <span>{thread.created_at ? new Date(thread.created_at).toLocaleDateString() : 'Unknown date'}</span>
                  </div>
                  
                  <Badge variant="outline" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    Thread
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!threadToDelete} onOpenChange={() => setThreadToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this thread and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteThread}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
