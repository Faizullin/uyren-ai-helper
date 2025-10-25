'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Square, 
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Calendar,
  User
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useThread, useThreadAgentRuns, useStopAgentRun } from '@/hooks/use-threads';

interface ThreadDetailPageProps {
  projectId: string;
  threadId: string;
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  running: { icon: Play, color: 'text-blue-500', bg: 'bg-blue-100' },
  completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100' },
  cancelled: { icon: Square, color: 'text-gray-500', bg: 'bg-gray-100' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100' },
};

export function ThreadDetailPage({ projectId, threadId }: ThreadDetailPageProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch thread details
  const { data: thread, isLoading: threadLoading, error: threadError } = useThread(threadId);

  // Fetch agent runs for this thread
  const { data: agentRunsResponse, isLoading: runsLoading, error: runsError, refetch } = useThreadAgentRuns(threadId);

  // Stop agent run mutation
  const stopAgentRunMutation = useStopAgentRun();

  const agentRuns = agentRunsResponse?.data || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast.success('Agent runs refreshed');
    } catch (error) {
      toast.error('Failed to refresh agent runs');
    } finally {
      setRefreshing(false);
    }
  };

  const handleBack = () => {
    router.push(`/projects/${projectId}/modules/edu_ai/threads`);
  };

  const handleViewLogs = (runId: string) => {
    router.push(`/projects/${projectId}/modules/edu_ai/threads/${threadId}/runs/${runId}`);
  };

  const handleStopRun = async (runId: string) => {
    try {
      await stopAgentRunMutation.mutateAsync(runId);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  if (threadError || runsError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load thread details</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={handleBack} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Threads
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {threadLoading ? (
                <Skeleton className="h-8 w-64" />
              ) : (
                thread?.title || 'Thread Details'
              )}
            </h1>
            <p className="text-muted-foreground">
              Manage agent runs and view execution logs
            </p>
          </div>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Thread Info */}
      {thread && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Thread Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Messages</p>
                <p>N/A</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Agent Runs</p>
                <p>{agentRuns.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-4 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : agentRuns.length === 0 ? (
            <div className="text-center py-8">
              <Play className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No agent runs yet</h3>
              <p className="text-muted-foreground">
                Start a demo task or agent run to see execution details here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {agentRuns.map((run: any) => {
                const statusInfo = statusConfig[run.status as keyof typeof statusConfig] || statusConfig.pending;
                const StatusIcon = statusInfo.icon;
                
                return (
                  <div
                    key={run.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-full ${statusInfo.bg}`}>
                        <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                      </div>
                      <div>
                        <p className="font-medium">
                          Run {run.id.slice(0, 8)}...
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {run.status}
                      </Badge>
                      
                      <Button
                        onClick={() => handleViewLogs(run.id)}
                        variant="outline"
                        size="sm"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Logs
                      </Button>
                      
                      {run.status === 'running' && (
                        <Button
                          onClick={() => handleStopRun(run.id)}
                          variant="destructive"
                          size="sm"
                        >
                          <Square className="h-4 w-4 mr-2" />
                          Stop
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Info */}
      {agentRunsResponse && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {agentRuns.length} of {agentRunsResponse.pagination?.total || agentRuns.length} agent runs
        </div>
      )}
    </div>
  );
}
