'use client';

import { useParams } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Loader2, ArrowLeft } from 'lucide-react';
import { useThread } from '@/hooks/use-threads';
import Link from 'next/link';

export default function ThreadDetailPage() {
  const params = useParams();
  const threadId = params.threadId as string;
  
  const { data: thread, isLoading } = useThread(threadId);

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="container mx-auto px-6 py-8">
        <Card className="p-12 text-center">
          <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Thread not found</h3>
          <p className="text-muted-foreground mb-4">
            The requested thread could not be found.
          </p>
          <Link href="/dashboard/threads">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Threads
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/dashboard/threads">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Threads
          </Button>
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex items-start gap-4 mb-6">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">
              {thread.metadata?.title || `Thread ${thread.thread_id.slice(0, 8)}`}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Thread ID: {thread.thread_id}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Details</h3>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{new Date(thread.created_at).toLocaleString()}</span>
              </div>
              {thread.updated_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Updated:</span>
                  <span>{new Date(thread.updated_at).toLocaleString()}</span>
                </div>
              )}
              {thread.project_id && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project ID:</span>
                  <span className="font-mono text-xs">{thread.project_id}</span>
                </div>
              )}
            </div>
          </div>

          {thread.metadata && Object.keys(thread.metadata).length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Metadata</h3>
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
                {JSON.stringify(thread.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

