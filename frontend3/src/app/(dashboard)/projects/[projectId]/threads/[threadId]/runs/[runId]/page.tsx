'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, 
  Square, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Terminal,
  Loader2,
  RefreshCw,
  MessageSquare
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAgentRunStatus, useStopAgentRun, useThreadMessages } from '@/hooks/use-threads';
import { AgentRunStatus, isActiveStatus, isTerminalStatus } from '@/lib/constants/agent-run-status';
import { config } from '@/lib/config';
import { createClient } from '@/lib/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface LogEntry {
  type: string;
  content?: string;  // Main content field
  message?: string;  // Alternative message field
  data?: Record<string, any>;  // Dynamic data field
  status?: string;
  timestamp?: string;
  level?: string;
  [key: string]: any;
}

const statusConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
  [AgentRunStatus.PENDING]: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-100', label: 'Pending' },
  [AgentRunStatus.RUNNING]: { icon: Play, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Running' },
  [AgentRunStatus.PROCESSING]: { icon: Play, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Processing' },
  [AgentRunStatus.COMPLETED]: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', label: 'Completed' },
  [AgentRunStatus.FAILED]: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Failed' },
  [AgentRunStatus.CANCELLED]: { icon: Square, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Cancelled' },
};

export default function AgentRunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const threadId = params.threadId as string;
  const runId = params.runId as string;

  const { data: agentRun, isLoading: runLoading, refetch } = useAgentRunStatus(runId, { 
    autoRefresh: true // Will auto-stop when run completes
  });
  const { data: messages, isLoading: messagesLoading } = useThreadMessages(threadId);
  const stopAgentRunMut = useStopAgentRun();

  const isActiveRun = agentRun && isActiveStatus(agentRun.status);

  // Custom EventSource for real-time logs
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isActiveRun || !runId) return;

    const connectStream = async () => {
      try {
        // Get auth token
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        if (!token) {
          setStreamError('Not authenticated');
          return;
        }

        // Close existing connection
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        // Create EventSource with auth - note: EventSource doesn't support custom headers
        // So we add token to URL as query param
        const streamUrl = `${config.BACKEND_URL}/api/v1/agent-run/${runId}/stream?token=${token}`;
        const eventSource = new EventSource(streamUrl);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          console.log('EventSource connected');
          setIsConnected(true);
          setStreamError(null);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as LogEntry;

            // Add timestamp if not present
            if (!data.timestamp) {
              data.timestamp = new Date().toISOString();
            }

            setLogs((prev) => [...prev, data]);

            // Auto-scroll to bottom
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }

            // Handle status changes
            if (data.type === 'status' && data.status && isTerminalStatus(data.status)) {
              console.log(`Agent run finished with status: ${data.status}`);
              toast.success(`Agent run ${data.status}`);
              eventSource.close();
              setIsConnected(false);
              refetch();
            }
          } catch (error) {
            console.error('Error parsing log:', error);
          }
        };

        eventSource.onerror = (error) => {
          console.error('EventSource error:', error);
          setStreamError('Connection lost');
          setIsConnected(false);
          eventSource.close();
        };

      } catch (error) {
        console.error('Failed to connect stream:', error);
        setStreamError('Failed to connect');
      }
    };

    connectStream();

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [runId, isActiveRun, refetch]);

  const handleStopRun = async () => {
    try {
      await stopAgentRunMut.mutateAsync(runId);
      refetch();
    } catch (error) {
      // Error handled by mutation
    }
  };

  if (runLoading) {
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
      </div>
    );
  }

  if (!agentRun) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Agent Run Not Found</h3>
            <p className="text-muted-foreground text-center mb-4">
              The agent run you're looking for doesn't exist
            </p>
            <Button asChild>
              <Link href={`/projects/${projectId}/threads/${threadId}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Thread
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = statusConfig[agentRun.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/projects/${projectId}/threads/${threadId}`}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Thread
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">Run {runId.slice(0, 8)}...</h1>
              <Badge variant="outline" className="capitalize">
                {statusInfo.label}
              </Badge>
            </div>
            <p className="text-muted-foreground">Agent Run Execution Details</p>
          </div>
        </div>
        
        {agentRun.status === AgentRunStatus.RUNNING && (
          <Button
            onClick={handleStopRun}
            variant="destructive"
            disabled={stopAgentRunMut.isPending}
          >
            {stopAgentRunMut.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <Square className="h-4 w-4 mr-2" />
                Stop Run
              </>
            )}
          </Button>
        )}
      </div>

      {/* Run Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${statusInfo.color}`} />
            Run Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="flex items-center gap-2 mt-1">
                <div className={`p-2 rounded-full ${statusInfo.bg}`}>
                  <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                </div>
                <p className="font-medium capitalize">{agentRun.status}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Started</p>
              <p className="font-medium mt-1">
                {agentRun.started_at && formatDistanceToNow(new Date(agentRun.started_at), { addSuffix: true })}
              </p>
            </div>
            {agentRun.completed_at && (
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="font-medium mt-1">
                  {formatDistanceToNow(new Date(agentRun.completed_at), { addSuffix: true })}
                </p>
              </div>
            )}
          </div>

          {/* Metadata Section */}
          {agentRun.my_metadata && typeof agentRun.my_metadata === 'object' && (
            <div className="border-t pt-4 space-y-3">
              <h4 className="font-medium text-sm">Task Metadata</h4>
              <div className="grid gap-3 md:grid-cols-2">
                {(() => {
                  const metadata = agentRun.my_metadata as Record<string, any>;
                  return (
                    <>
                      {metadata.task_name && (
                        <div>
                          <p className="text-xs text-muted-foreground">Task Name</p>
                          <p className="text-sm font-medium">{String(metadata.task_name)}</p>
                        </div>
                      )}
                      {metadata.task_type && (
                        <div>
                          <p className="text-xs text-muted-foreground">Task Type</p>
                          <p className="text-sm font-medium">{String(metadata.task_type)}</p>
                        </div>
                      )}
                      {metadata.model_name && (
                        <div>
                          <p className="text-xs text-muted-foreground">Model</p>
                          <p className="text-sm font-medium">{String(metadata.model_name)}</p>
                        </div>
                      )}
                    </>
                  );
                })()}
                {agentRun.agent_id && (
                  <div>
                    <p className="text-xs text-muted-foreground">Agent ID</p>
                    <p className="text-sm font-mono">{String(agentRun.agent_id).slice(0, 8)}...</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Message */}
          {agentRun.error_message && (
            <div className="border-t pt-4">
              <h4 className="font-medium text-sm text-red-600 mb-2">Error Message</h4>
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-800 dark:text-red-200 font-mono">
                  {agentRun.error_message}
                </p>
              </div>
            </div>
          )}

          {/* IDs Section */}
          <div className="border-t pt-4 space-y-2">
            <h4 className="font-medium text-sm">Identifiers</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Run ID:</span>
                <code className="bg-muted px-2 py-1 rounded">{agentRun.id}</code>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Thread ID:</span>
                <code className="bg-muted px-2 py-1 rounded">{agentRun.thread_id}</code>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Content Tabs */}
      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            Live Logs
            {isConnected && isActiveRun && (
              <span className="w-2 h-2 bg-green-400 rounded-full ml-1 animate-pulse" />
            )}
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
        </TabsList>

        {/* Live Logs Tab */}
        <TabsContent value="logs" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Live Logs
                  {isConnected && isActiveRun && (
                    <Badge variant="default" className="text-xs ml-2">
                      <span className="w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse" />
                      Streaming
                    </Badge>
                  )}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {logs.length} log(s)
                  </span>
                  {streamError && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.reload()}
                    >
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
          <div className="h-[500px] w-full rounded-md border bg-black/5 dark:bg-black/50 overflow-y-auto p-4" ref={scrollRef}>
            {logs.length === 0 ? (
              <div className="text-center py-12">
                {isActiveRun ? (
                  <div className="text-muted-foreground">
                    <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin" />
                    <p className="text-sm">
                      {isConnected ? 'Waiting for logs...' : 'Connecting to stream...'}
                    </p>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    <Terminal className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No logs available for this run</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2 font-mono text-xs">
                {logs.map((log, index) => {
                  const displayMessage = log.content || log.message;
                  const hasData = log.data && Object.keys(log.data).length > 0;
                  
                  return (
                    <div key={index} className="text-foreground/90 leading-relaxed">
                      <div>
                        <span className="text-muted-foreground">[{log.timestamp?.slice(11, 19) || 'N/A'}]</span>{' '}
                        <span className={
                          log.level === 'error' ? 'text-red-400 font-semibold' :
                          log.level === 'warning' ? 'text-yellow-400 font-semibold' :
                          log.level === 'info' ? 'text-blue-400' :
                          log.level === 'success' ? 'text-green-400' :
                          'text-foreground/70'
                        }>
                          [{log.level?.toUpperCase() || log.type?.toUpperCase() || 'LOG'}]
                        </span>{' '}
                        <span className="text-foreground/80">{displayMessage}</span>
                      </div>
                      {hasData && (
                        <div className="ml-16 mt-1 text-cyan-400/80 space-y-0.5">
                          {Object.entries(log.data!).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <span className="text-cyan-300/60">└─</span>
                              <span className="text-cyan-300">{key}:</span>
                              <span className="text-cyan-100/70">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
              {streamError && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-red-800 dark:text-red-200 mb-1">
                        Stream Connection Error
                      </h4>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        {streamError}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                        The connection has stopped retrying after multiple attempts. Please refresh the page to try again.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Thread Messages
                </CardTitle>
                <span className="text-sm text-muted-foreground">
                  {messages?.length || 0} message(s)
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[500px] w-full rounded-md border bg-black/5 dark:bg-black/50 overflow-y-auto p-4">
                {messagesLoading ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-muted-foreground" />
                    <p className="text-muted-foreground">Loading messages...</p>
                  </div>
                ) : !messages || messages.length === 0 ? (
                  <div className="text-center py-12">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No messages yet</h3>
                    <p className="text-muted-foreground">
                      Messages will appear here when the agent generates responses
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 font-mono text-xs">
                    {messages.map((message: any, index: number) => {
                      const timestamp = message.created_at 
                        ? new Date(message.created_at).toISOString().slice(11, 19)
                        : 'N/A';
                      const isUser = message.role === 'user';
                      
                      return (
                        <div key={message.id} className="text-foreground/90 leading-relaxed">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-muted-foreground">[{timestamp}]</span>
                            <span className={
                              isUser 
                                ? 'text-blue-400 font-semibold' 
                                : 'text-green-400 font-semibold'
                            }>
                              [{isUser ? 'USER' : 'ASSISTANT'}]
                            </span>
                            {message.id && (
                              <span className="text-muted-foreground/50 text-[10px]">
                                ID: {message.id.slice(0, 8)}
                              </span>
                            )}
                          </div>
                          <div className={`ml-16 text-foreground/80 whitespace-pre-wrap ${
                            isUser ? 'text-blue-100/90' : 'text-green-100/90'
                          }`}>
                            {message.content}
                          </div>
                          {index < messages.length - 1 && (
                            <div className="border-b border-muted-foreground/10 mt-3"></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

