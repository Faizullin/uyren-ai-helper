'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Settings,
  Target,
  Users,
  Zap,
  Play,
  Loader2,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { useStartDemoTask } from '@/hooks/use-demo-tasks';
import { useState } from 'react';

interface ModuleDetailsContentProps {
  projectId: string;
}

export function ModuleDetailsContent({ projectId }: ModuleDetailsContentProps) {
  const [taskName, setTaskName] = useState('demo_processing');
  const startDemoTaskMutation = useStartDemoTask();

  const handleStartDemoTask = async () => {
    try {
      await startDemoTaskMutation.mutateAsync({
        projectId,
        taskName,
      });
    } catch (error) {
      // Error is handled by the mutation's onError
      console.error('Demo task failed:', error);
    }
  };

  // For now, we'll show a placeholder for the Edu AI module
  const moduleInfo = {
    id: 'edu_ai',
    name: 'Edu AI',
    description: 'Educational AI assistant for learning and teaching',
    status: 'active',
    features: [
      'Personalized learning paths',
      'Interactive Q&A sessions',
      'Progress tracking',
      'Adaptive content delivery',
      'Multi-language support'
    ],
    stats: {
      totalSessions: 0,
      activeUsers: 0,
      completionRate: 0
    }
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
            <h1 className="text-3xl font-bold flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <GraduationCap className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <span>{moduleInfo.name}</span>
            </h1>
            <p className="text-muted-foreground">Module Configuration</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button 
            onClick={handleStartDemoTask}
            disabled={startDemoTaskMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {startDemoTaskMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting Demo...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Demo Task
              </>
            )}
          </Button>
          <Button>
            <Zap className="h-4 w-4 mr-2" />
            Activate Module
          </Button>
        </div>
      </div>

      {/* Module Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Module Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Badge variant={moduleInfo.status === 'active' ? 'default' : 'secondary'}>
              {moduleInfo.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
            <p className="text-sm text-muted-foreground">
              Module ID: <code className="bg-muted px-2 py-1 rounded">{moduleInfo.id}</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Module Description */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5" />
            <span>About This Module</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            {moduleInfo.description}
          </p>
          <div className="space-y-2">
            <h4 className="font-medium">Key Features:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {moduleInfo.features.map((feature, index) => (
                <li key={index}>{feature}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Module Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Module Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{moduleInfo.stats.totalSessions}</div>
              <div className="text-sm text-muted-foreground">Total Sessions</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{moduleInfo.stats.activeUsers}</div>
              <div className="text-sm text-muted-foreground">Active Users</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{moduleInfo.stats.completionRate}%</div>
              <div className="text-sm text-muted-foreground">Completion Rate</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Threads Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Threads Management
          </CardTitle>
          <CardDescription>
            View and manage your educational AI conversations and tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Access your educational AI threads, view agent runs, and monitor execution logs.
            </p>
            <div className="flex gap-2">
              <Link href={`/projects/${projectId}/modules/edu_ai/threads`}>
                <Button variant="default">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  View All Threads
                </Button>
              </Link>
            </div>
            <div className="text-sm text-muted-foreground">
              <p><strong>What you can do:</strong></p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Browse all your educational AI conversations</li>
                <li>View agent runs and their execution status</li>
                <li>Monitor real-time logs and progress</li>
                <li>Stop running tasks if needed</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Demo Task Runner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Play className="h-5 w-5" />
            <span>Demo Task Runner</span>
          </CardTitle>
          <CardDescription>
            Test the educational AI module with a demo processing task
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label htmlFor="task-name" className="block text-sm font-medium mb-2">
                  Task Name
                </label>
                <input
                  id="task-name"
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter task name"
                />
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={handleStartDemoTask}
                  disabled={startDemoTaskMutation.isPending || !taskName.trim()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {startDemoTaskMutation.isPending ? (
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
            
            {startDemoTaskMutation.isSuccess && startDemoTaskMutation.data && (
              <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                  Demo Task Started Successfully!
                </h4>
                <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <p>Agent Run ID: <code className="bg-green-100 dark:bg-green-800 px-1 rounded">{startDemoTaskMutation.data.agent_run_id}</code></p>
                  {startDemoTaskMutation.data.thread_id && (
                    <p>Thread ID: <code className="bg-green-100 dark:bg-green-800 px-1 rounded">{startDemoTaskMutation.data.thread_id}</code></p>
                  )}
                  {startDemoTaskMutation.data.model_name && (
                    <p>Model: <code className="bg-green-100 dark:bg-green-800 px-1 rounded">{startDemoTaskMutation.data.model_name}</code></p>
                  )}
                  <p className="mt-2">
                    The demo task has been queued and will process in the background. 
                    You can monitor its progress in the project threads.
                  </p>
                </div>
              </div>
            )}

            {startDemoTaskMutation.isError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                  Demo Task Failed
                </h4>
                <p className="text-sm text-red-700 dark:text-red-300">
                  There was an error starting the demo task. Please check the console for more details and try again.
                </p>
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              <p><strong>What this demo does:</strong></p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Creates a new thread for the demo task</li>
                <li>Starts a background processing workflow</li>
                <li>Simulates educational AI processing (10-15 seconds)</li>
                <li>Returns task status and tracking information</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Placeholder */}
      <Card>
        <CardHeader>
          <CardTitle>Module Configuration</CardTitle>
          <CardDescription>
            Configure module settings and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-semibold mb-2">Configuration Coming Soon</h3>
            <p>Module configuration options will be available here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
