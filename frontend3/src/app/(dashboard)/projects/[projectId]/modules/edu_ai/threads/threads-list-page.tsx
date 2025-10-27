'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MessageSquare, 
  Calendar, 
  User, 
  ArrowRight, 
  RefreshCw,
  Plus
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { useEduAiThreads } from '@/hooks/use-threads';

interface ThreadsListPageProps {
  projectId: string;
}

export function ThreadsListPage({ projectId }: ThreadsListPageProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: threadsResponse, isLoading, error, refetch } = useEduAiThreads(projectId);

  const threads = threadsResponse?.data || [];

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
      toast.success('Threads refreshed');
    } catch (error) {
      toast.error('Failed to refresh threads');
    } finally {
      setRefreshing(false);
    }
  };

  const handleThreadClick = (threadId: string) => {
    router.push(`/projects/${projectId}/threads/${threadId}`);
  };

  const handleCreateThread = () => {
    // Navigate to project threads page or dashboard
    router.push(`/projects/${projectId}/threads`);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-500 mb-4">Failed to load threads</p>
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
        <div>
          <h1 className="text-3xl font-bold">Edu AI Threads</h1>
          <p className="text-muted-foreground">
            Manage your educational AI conversations and tasks
          </p>
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
          <Button onClick={handleCreateThread}>
            <Plus className="h-4 w-4 mr-2" />
            New Thread
          </Button>
        </div>
      </div>

      {/* Threads Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-full mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : threads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No threads yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start a new conversation or educational task to see it here.
            </p>
            <Button onClick={handleCreateThread}>
              <Plus className="h-4 w-4 mr-2" />
              Create First Thread
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {threads.map((thread: any) => (
            <Card 
              key={thread.id} 
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handleThreadClick(thread.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">
                    {thread.title || 'Untitled Thread'}
                  </CardTitle>
                  <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      {thread.message_count || 0} messages
                    </span>
                  </div>
                  {thread.project_id && (
                    <Badge variant="secondary" className="text-xs">
                      Project: {thread.project_id.slice(0, 8)}...
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Info */}
      {threadsResponse && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {threads.length} of {threadsResponse.pagination?.total || threads.length} threads
        </div>
      )}
    </div>
  );
}
