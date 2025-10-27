import { useState, useRef, useEffect } from 'react';
import { useThread } from '@/hooks/use-threads';
import { useProject } from '@/hooks/use-projects';
import { useAgentRunsQuery } from '@/hooks/use-agent-runs';

export function useThreadData(threadId: string, projectId?: string) {
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('');
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  
  const initialLoadCompleted = useRef<boolean>(false);

  // Queries
  const threadQuery = useThread(threadId);
  const projectQuery = useProject(projectId || '');
  const agentRunsQuery = useAgentRunsQuery(threadId);
  // const messagesQuery = useMessages(threadId);

  // Initialize data
  useEffect(() => {
    let isMounted = true;

    async function initializeData() {
      if (!initialLoadCompleted.current) setIsLoading(true);
      setError(null);

      try {
        if (!threadId) throw new Error('Thread ID is required');

        if (threadQuery.isError) {
          throw new Error('Failed to load thread data: ' + threadQuery.error);
        }
        if (!isMounted) return;

        // Set project data
        if (projectQuery.data) {
          setProjectName(projectQuery.data.name || '');
          // TODO: Add sandbox ID handling when available in ProjectPublic type
          setSandboxId(null);
        }

        // Mark as completed
        initialLoadCompleted.current = true;
        setIsLoading(false);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setIsLoading(false);
        }
      }
    }

    initializeData();

    return () => {
      isMounted = false;
    };
  }, [threadId, threadQuery.isError, threadQuery.error, projectQuery.data]);

  return {
    threadQuery,
    projectQuery,
    agentRunsQuery,
    // messagesQuery,
    isLoading,
    error,
    initialLoadCompleted: initialLoadCompleted.current,
    projectName,
    sandboxId,
  };
}
