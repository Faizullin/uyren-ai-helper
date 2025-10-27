'use client';

import React, { useState } from 'react';
import { useProject, useUpdateProject, useDeleteProject } from '@/hooks/use-projects';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { 
  ArrowLeft,
  Edit,
  Trash2,
  Calendar,
  User,
  Globe,
  Lock,
  FolderOpen,
  MessageSquare,
  BookOpen,
  GraduationCap,
  Database
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ProjectDetailsContentProps {
  projectId: string;
}

export function ProjectDetailsContent({ projectId }: ProjectDetailsContentProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState({
    name: '',
    description: '',
    is_public: false,
  });

  const router = useRouter();

  const projectQuery = useProject(projectId);
  const updateProjectMutation = useUpdateProject();
  const deleteProjectMutation = useDeleteProject();

  const handleUpdateProject = async () => {
    if (!editProject.name.trim()) return;
    
    try {
      await updateProjectMutation.mutateAsync({
        projectId,
        ...editProject,
      });
      setIsEditDialogOpen(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDeleteProject = async () => {
    try {
      await deleteProjectMutation.mutateAsync(projectId);
      router.push('/projects');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const openEditDialog = () => {
    if (projectQuery.data) {
      setEditProject({
        name: projectQuery.data.name,
        description: projectQuery.data.description || '',
        is_public: projectQuery.data.is_public,
      });
      setIsEditDialogOpen(true);
    }
  };

  if (projectQuery.isLoading) {
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
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div>
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-20 w-full" />
              </div>
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-6 w-16" />
              </div>
            </div>
          </CardContent>
        </Card>
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
            <Link href="/projects">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            <p className="text-muted-foreground">Project Details</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/threads`}>
              <MessageSquare className="h-4 w-4 mr-2" />
              View Threads
            </Link>
          </Button>

          <Button variant="outline" asChild>
            <Link href={`/projects/${projectId}/vector-stores`}>
              <Database className="h-4 w-4 mr-2" />
              Vector Stores
            </Link>
          </Button>
          
          <Button variant="outline" onClick={openEditDialog}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Project</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{project.name}"? This action cannot be undone and will delete all associated threads.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteProject}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="main" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="main" className="flex items-center space-x-2">
            <FolderOpen className="h-4 w-4" />
            <span>Main</span>
          </TabsTrigger>
          <TabsTrigger value="modules" className="flex items-center space-x-2">
            <BookOpen className="h-4 w-4" />
            <span>Modules</span>
          </TabsTrigger>
        </TabsList>

        {/* Main Tab */}
        <TabsContent value="main" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
              <CardDescription>
                View and manage your project details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Project Name</Label>
                  <div className="p-3 bg-muted rounded-md">
                    <p className="font-medium">{project.name}</p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Visibility</Label>
                  <div className="p-3 bg-muted rounded-md">
                    <div className="flex items-center space-x-2">
                      {project.is_public ? (
                        <>
                          <Globe className="h-4 w-4 text-green-600" />
                          <Badge variant="secondary">Public</Badge>
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4 text-orange-600" />
                          <Badge variant="outline">Private</Badge>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Description</Label>
                <div className="p-3 bg-muted rounded-md min-h-[100px]">
                  <p className="text-muted-foreground">
                    {project.description || 'No description provided'}
                  </p>
                </div>
              </div>

              {/* Metadata */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Created</Label>
                  <div className="p-3 bg-muted rounded-md">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{new Date(project.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Last Updated</Label>
                  <div className="p-3 bg-muted rounded-md">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{new Date(project.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Project ID */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Project ID</Label>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-sm font-mono">{project.id}</code>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Modules Tab */}
        <TabsContent value="modules" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Modules</CardTitle>
              <CardDescription>
                Manage and configure project modules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {/* Edu AI Module */}
                <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                          <GraduationCap className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold">Edu AI</h3>
                          <p className="text-sm text-muted-foreground">
                            Educational AI assistant for learning and teaching
                          </p>
                        </div>
                      </div>
                      <Button asChild>
                        <Link href={`/projects/${projectId}/modules/edu_ai`}>
                          Configure
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Placeholder for future modules */}
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>More modules will be available soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                placeholder="Enter project name"
                value={editProject.name}
                onChange={(e) => setEditProject(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Enter project description (optional)"
                value={editProject.description}
                onChange={(e) => setEditProject(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch
                id="edit-is_public"
                checked={editProject.is_public}
                onCheckedChange={(checked) => setEditProject(prev => ({ ...prev, is_public: checked }))}
              />
              <Label htmlFor="edit-is_public">Make this project public</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateProject}
              disabled={!editProject.name.trim() || updateProjectMutation.isPending}
            >
              {updateProjectMutation.isPending ? 'Updating...' : 'Update Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
