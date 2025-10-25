'use client';

import React from 'react';
import { ThreadComponent } from '@/components/thread/ThreadComponent';

interface ProjectThreadContentProps {
  projectId: string;
  threadId: string;
}

export function ProjectThreadContent({ projectId, threadId }: ProjectThreadContentProps) {
  return <ThreadComponent projectId={projectId} threadId={threadId} />;
}
