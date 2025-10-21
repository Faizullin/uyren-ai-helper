'use client';

import React from 'react';
import { ThreadComponent } from '@/components/thread/ThreadComponent';
import { useParams } from 'next/navigation';

export default function ThreadChatPage() {
  const params = useParams();
  const threadId = params.threadId as string;

  return (
    <div className="h-screen w-full">
      <ThreadComponent
        projectId="" // Optional - can be empty for threads without projects
        threadId={threadId}
        compact={false}
      />
    </div>
  );
}

