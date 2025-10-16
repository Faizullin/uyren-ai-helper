'use client';

import { useState } from 'react';
import { Search, Loader2, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useThreads } from '@/hooks/use-threads';
import { ThreadCard } from '@/components/threads/thread-card';
import { formatDistanceToNow } from 'date-fns';

export default function ThreadsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: threads, isLoading, refetch } = useThreads();

  const filteredThreads = threads?.filter(thread => {
    const search = searchQuery.toLowerCase();
    return thread.thread_id.toLowerCase().includes(search) ||
      thread.metadata?.title?.toLowerCase().includes(search);
  }) || [];

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Threads</h1>
            <p className="text-muted-foreground mt-1">
              View and manage your conversation threads
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search threads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredThreads.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto max-w-md">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No threads found' : 'No threads yet'}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Threads will appear here when you start conversations with agents'}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredThreads.map((thread) => (
            <ThreadCard key={thread.thread_id} thread={thread} onUpdate={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}

