'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, 
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Square,
  Play,
  Download,
  Copy,
  Calendar,
  User,
  Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useAgentRunStatus, useStopAgentRun } from '@/hooks/use-threads';
import { useAgentRunStream } from '@/hooks/use-agent-run-stream';

interface AgentRunLogsPageProps {
  projectId: string;
  threadId: string;
  runId: string;
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100' },
  running: { icon: Play, color: 'text-blue-500', bg: 'bg-blue-100' },
  completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100' },
  cancelled: { icon: Square, color: 'text-gray-500', bg: 'bg-gray-100' },
  error: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100' },
};

export function AgentRunLogsPage({ projectId, threadId, runId }: AgentRunLogsPageProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch agent run details
  const { data: agentRun, isLoading: runLoading, error: runError } = useAgentRunStatus(runId, { 
    autoRefresh 
  });

  // Stop agent run mutation
  const stopAgentRunMutation = useStopAgentRun();

  // Stream logs for running agent runs
  const { 
    logs, 
    isConnected, 
    error: streamError, 
    connect, 
    disconnect, 
    clearLogs 
  } = useAgentRunStream(runId, {
    enabled: agentRun?.status === 'running',
    onLog: (log) => {
      console.log('Received log:', log);
    },
    onStatusChange: (status) => {
      console.log('Status changed to:', status);
      if (['completed', 'failed', 'stopped'].includes(status)) {
        setAutoRefresh(false);
        toast.success(`Agent run ${status}`);
      }
    },
    onError: (error) => {
      console.error('Stream error:', error);
      toast.error('Stream connection error');
    }
  });

  // Auto-refresh control based on run status
  useEffect(() => {
    if (agentRun) {
      const isActive = ['pending', 'running'].includes(agentRun.status);
      setAutoRefresh(isActive);
    }
  }, [agentRun]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Clear logs and reconnect if running
      if (agentRun?.status === 'running') {
        clearLogs();
        disconnect();
        setTimeout(() => connect(), 100);
      }
      toast.success('Logs refreshed');
    } catch (error) {
      toast.error('Failed to refresh logs');
    } finally {
      setRefreshing(false);
    }
  };

  const handleBack = () => {
    router.push(`/projects/${projectId}/modules/edu_ai/threads/${threadId}`);
  };

  const handleStopRun = async () => {
    if (!agentRun) return;
    
    try {
      await stopAgentRunMutation.mutateAsync(runId);
      // Disconnect stream after stopping
      disconnect();
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const handleCopyLogs = () => {
    const logText = logs.map(log => `[${log.timestamp}] ${log.level}: ${log.message}`).join('\n');
    navigator.clipboard.writeText(logText);
    toast.success('Logs copied to clipboard');
  };

  const handleDownloadLogs = () => {
    const logText = logs.map(log => `[${log.timestamp}] ${log.level}: ${log.message}`).join('\n');
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-run-${runId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Logs downloaded');
  };

  if (runError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load agent run details</p>
          <Button onClick={handleRefresh} variant="outline">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  const statusInfo = agentRun ? statusConfig[agentRun.status as keyof typeof statusConfig] || statusConfig.pending : null;
  const StatusIcon = statusInfo?.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={handleBack} variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Thread
          </Button>
          <div>
            <h1 className="text-3xl font-bold">
              {runLoading ? (
                <Skeleton className="h-8 w-64" />
              ) : (
                `Agent Run ${runId.slice(0, 8)}...`
              )}
            </h1>
            <p className="text-muted-foreground">
              View execution logs and monitor progress
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {agentRun?.status === 'running' && (
            <Button
              onClick={handleStopRun}
              variant="destructive"
              size="sm"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Run
            </Button>
          )}
        </div>
      </div>

      {/* Agent Run Info */}
      {agentRun && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Run Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {StatusIcon && (
                    <div className={`p-1 rounded-full ${statusInfo?.bg}`}>
                      <StatusIcon className={`h-3 w-3 ${statusInfo?.color}`} />
                    </div>
                  )}
                  <Badge variant="outline" className="capitalize">
                    {agentRun.status}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Started</p>
                <p className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" />
                  {formatDistanceToNow(new Date(agentRun.started_at), { addSuffix: true })}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Model</p>
                <p>N/A</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Logs</p>
                <p>{logs.length} entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className={`h-5 w-5 ${isConnected ? 'animate-spin' : ''}`} />
              Execution Logs
              {isConnected && (
                <Badge variant="secondary" className="text-xs">
                  Streaming
                </Badge>
              )}
              {streamError && (
                <Badge variant="destructive" className="text-xs">
                  Connection Error
                </Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={handleCopyLogs}
                variant="outline"
                size="sm"
                disabled={logs.length === 0}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
              <Button
                onClick={handleDownloadLogs}
                variant="outline"
                size="sm"
                disabled={logs.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {runLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No logs available</h3>
              <p className="text-muted-foreground">
                Logs will appear here as the agent run executes.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-96 w-full">
              <div className="space-y-1 font-mono text-sm">
                {logs.map((log, index) => {
                  const logLevel = log.level || log.type || 'info';
                  const logMessage = log.message || JSON.stringify(log);
                  const logTimestamp = log.timestamp || new Date().toISOString();
                  
                  return (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-2 rounded ${
                        logLevel === 'error' ? 'bg-red-50 text-red-900' :
                        logLevel === 'warning' ? 'bg-yellow-50 text-yellow-900' :
                        logLevel === 'info' ? 'bg-blue-50 text-blue-900' :
                        logLevel === 'status' ? 'bg-green-50 text-green-900' :
                        'bg-gray-50 text-gray-900'
                      }`}
                    >
                      <span className="text-xs text-muted-foreground flex-shrink-0 w-20">
                        {new Date(logTimestamp).toLocaleTimeString()}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs flex-shrink-0 ${
                          logLevel === 'error' ? 'border-red-300 text-red-700' :
                          logLevel === 'warning' ? 'border-yellow-300 text-yellow-700' :
                          logLevel === 'info' ? 'border-blue-300 text-blue-700' :
                          logLevel === 'status' ? 'border-green-300 text-green-700' :
                          'border-gray-300 text-gray-700'
                        }`}
                      >
                        {logLevel.toUpperCase()}
                      </Badge>
                      <span className="flex-1 break-words">
                        {logMessage}
                      </span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Connection status indicator */}
      {agentRun?.status === 'running' && (
        <div className="text-center text-sm text-muted-foreground">
          {isConnected ? (
            <>
              <RefreshCw className="h-4 w-4 inline mr-2 animate-spin" />
              Streaming logs in real-time
            </>
          ) : streamError ? (
            <>
              <AlertCircle className="h-4 w-4 inline mr-2 text-red-500" />
              Stream connection failed - {streamError}
            </>
          ) : (
            <>
              <Clock className="h-4 w-4 inline mr-2" />
              Connecting to stream...
            </>
          )}
        </div>
      )}
    </div>
  );
}
