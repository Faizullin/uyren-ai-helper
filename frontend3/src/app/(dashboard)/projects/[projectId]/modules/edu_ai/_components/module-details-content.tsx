'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  GraduationCap,
  MessageSquare,
  Database,
  Play,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useStartDemoTask } from '@/hooks/use-demo-tasks';

interface ModuleDetailsContentProps {
  projectId: string;
}

export function ModuleDetailsContent({ projectId }: ModuleDetailsContentProps) {
  const startDemoMut = useStartDemoTask();

  const handleStartDemo = async () => {
    await startDemoMut.mutateAsync({
      projectId,
      taskName: 'demo_processing',
    });
  };

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
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <GraduationCap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <span>Edu AI</span>
            </h1>
            <p className="text-muted-foreground">Educational AI Module</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link href={`/projects/${projectId}/modules/edu_ai/threads`}>
            <Button variant="outline">
              <MessageSquare className="h-4 w-4 mr-2" />
              View Threads
            </Button>
          </Link>
          <Link href="/knowledge">
            <Button variant="outline">
              <Database className="h-4 w-4 mr-2" />
              Knowledge Base
            </Button>
          </Link>
          <Button 
            onClick={handleStartDemo}
            disabled={startDemoMut.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {startDemoMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Demo Task
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Module Info */}
      <Card>
        <CardHeader>
          <CardTitle>Module Overview</CardTitle>
          <CardDescription>
            Educational AI assistant for learning and teaching
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant="default">Active</Badge>
            <span className="text-sm text-muted-foreground">
              Module ID: <code className="bg-muted px-2 py-1 rounded text-xs">edu_ai</code>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Access Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Threads */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <MessageSquare className="h-5 w-5" />
              Threads
            </CardTitle>
            <CardDescription>
              View and manage AI conversations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/projects/${projectId}/modules/edu_ai/threads`}>
              <Button variant="outline" className="w-full">
                View All Threads
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Knowledge Base */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />
              Knowledge Base
            </CardTitle>
            <CardDescription>
              Manage learning materials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/knowledge">
              <Button variant="outline" className="w-full">
                Manage Files
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Vector Stores */}
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Database className="h-5 w-5" />
              Vector Stores
            </CardTitle>
            <CardDescription>
              RAG embeddings & search
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/projects/${projectId}/vector-stores`}>
              <Button variant="outline" className="w-full">
                Manage Stores
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Demo Task Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Demo Task Runner
          </CardTitle>
          <CardDescription>
            Test the educational AI module with a background processing task
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              What the demo task does:
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-disc list-inside">
              <li>Creates a new thread for the demo task</li>
              <li>Starts a background processing workflow</li>
              <li>Simulates educational AI processing (10-15 seconds)</li>
              <li>You'll be redirected to the thread to see live updates</li>
            </ul>
          </div>

          <Button 
            onClick={handleStartDemo}
            disabled={startDemoMut.isPending}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            {startDemoMut.isPending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Starting Demo Task...
              </>
            ) : (
              <>
                <Play className="h-5 w-5 mr-2" />
                Start Demo Task
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
