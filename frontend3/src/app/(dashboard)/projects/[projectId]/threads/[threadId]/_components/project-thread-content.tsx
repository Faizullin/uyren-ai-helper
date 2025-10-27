'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ThreadComponent } from '@/components/thread/ThreadComponent';
import { 
  Play, 
  Square, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  Eye,
  RotateCcw,
  Trash2,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useThread, useThreadMessages, useThreadAgentRuns, useStopAgentRun, useRetryAgentRun, useDeleteAgentRun } from '@/hooks/use-threads';
import { AgentRunStatus, canRetryStatus, isTerminalStatus } from '@/lib/constants/agent-run-status';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ProjectThreadContentProps {
  projectId: string;
  threadId: string;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  [AgentRunStatus.PENDING]: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'Pending' },
  [AgentRunStatus.RUNNING]: { icon: Play, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Running' },
  [AgentRunStatus.PROCESSING]: { icon: Play, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Processing' },
  [AgentRunStatus.COMPLETED]: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', label: 'Completed' },
  [AgentRunStatus.FAILED]: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Failed' },
  [AgentRunStatus.CANCELLED]: { icon: Square, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Cancelled' },
};

export function ProjectThreadContent({ projectId, threadId }: ProjectThreadContentProps) {
  const router = useRouter();
  
  const { data: thread, isLoading: threadLoading } = useThread(threadId);
  const { data: messages, isLoading: messagesLoading } = useThreadMessages(threadId);
  const { data: agentRunsResponse, isLoading: runsLoading, refetch } = useThreadAgentRuns(threadId);
  const stopAgentRunMut = useStopAgentRun();
  const retryAgentRunMut = useRetryAgentRun();
  const deleteAgentRunMut = useDeleteAgentRun();
  
  const agentRuns = agentRunsResponse?.data || [];

  const handleStopRun = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await stopAgentRunMut.mutateAsync(runId);
      refetch();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleViewRun = (runId: string) => {
    router.push(`/projects/${projectId}/threads/${threadId}/runs/${runId}`);
  };

  const handleRetryRun = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await retryAgentRunMut.mutateAsync(runId);
      refetch();
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDeleteRun = async (runId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteAgentRunMut.mutateAsync(runId);
      refetch();
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (threadLoading || runsLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-10 w-10" />
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-32 mt-2" />
          </div>
        </div>
        
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
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/projects/${projectId}/threads`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Threads
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{thread?.title || 'Thread'}</h1>
            <p className="text-muted-foreground">Agent Runs & Execution Logs</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={runsLoading}
        >
          <RefreshCw className={`h-4 w-4 ${runsLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Thread Info */}
      {thread && (
        <Card>
          <CardHeader>
            <CardTitle>Thread Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">
                {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="font-medium">{thread.description || 'N/A'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Agent Runs</p>
              <p className="font-medium">{agentRuns.length}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content Tabs */}
      <Tabs defaultValue="runs" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="runs" className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Agent Runs
          </TabsTrigger>
        </TabsList>

        {/* Messages Tab */}
        <TabsContent value="messages" className="mt-6">
          {messagesLoading ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-muted-foreground" />
                  <p className="text-muted-foreground">Loading messages...</p>
                </div>
              </CardContent>
            </Card>
          ) : !messages || messages.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Messages will appear here when the agent generates responses
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {messages.map((message: any) => (
                <Card key={message.id} className={message.role === 'user' ? 'bg-muted/50' : ''}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={message.role === 'user' ? 'default' : 'secondary'}>
                          {message.role === 'user' ? 'You' : 'Assistant'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Agent Runs Tab */}
        <TabsContent value="runs" className="mt-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">Agent Runs</h2>
        
        {agentRuns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Play className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No agent runs yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Agent runs will appear here when tasks are executed
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {agentRuns.map((run: any) => {
              const statusInfo = statusConfig[run.status as keyof typeof statusConfig] || statusConfig.pending;
              const StatusIcon = statusInfo.icon;
              
              return (
                <Card 
                  key={run.id}
                  className="hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleViewRun(run.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`p-2 rounded-full ${statusInfo.bg}`}>
                          <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">
                              Run {run.id.slice(0, 8)}...
                            </h3>
                            <Badge variant="outline" className="capitalize text-xs">
                              {statusInfo.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Started {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                          </p>
                          {run.my_metadata?.model_name && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Model: {run.my_metadata.model_name}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleViewRun(run.id);
                          }}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        
                        {run.status === AgentRunStatus.RUNNING && (
                          <Button
                            onClick={(e) => handleStopRun(run.id, e)}
                            variant="destructive"
                            size="sm"
                            disabled={stopAgentRunMut.isPending}
                          >
                            <Square className="h-3 w-3 mr-1" />
                            Stop
                          </Button>
                        )}

                        {canRetryStatus(run.status) && (
                          <Button
                            onClick={(e) => handleRetryRun(run.id, e)}
                            variant="secondary"
                            size="sm"
                            disabled={retryAgentRunMut.isPending}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Retry
                          </Button>
                        )}

                        {isTerminalStatus(run.status) && (
                          <Button
                            onClick={(e) => handleDeleteRun(run.id, e)}
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={deleteAgentRunMut.isPending}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

