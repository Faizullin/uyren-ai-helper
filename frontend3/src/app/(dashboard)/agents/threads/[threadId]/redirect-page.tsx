'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useThread } from '@/hooks/use-threads';
import { ThreadSkeleton } from '@/components/thread/content/ThreadSkeleton';

interface RedirectPageProps {
  threadId: string;
}

export function RedirectPage({ threadId }: RedirectPageProps) {
  const router = useRouter();
  const loadThreadQuery = useThread(threadId);

  useEffect(() => {
    if (loadThreadQuery.data?.project_id) {
      router.replace(`/projects/${loadThreadQuery.data.project_id}/threads/${threadId}`);
    }
  }, [loadThreadQuery.data, threadId, router]);

  if (loadThreadQuery.isError) {
    router.replace('/dashboard');
    return null;
  }
  return <ThreadSkeleton isSidePanelOpen={false} />;
} 