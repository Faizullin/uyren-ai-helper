'use client';

import { ChatInput } from '@/components/thread/chat-input/chat-input';
import { ThreadContent } from '@/components/thread/content/ThreadContent';
import { ThreadSkeleton } from '@/components/thread/content/ThreadSkeleton';
import { ThreadLayout } from '@/components/thread/ThreadLayout';
import { useAgents } from '@/hooks/use-agents';
import { useIsMobile } from '@/hooks/use-mobile';
import { useThreadData } from '@/hooks/use-thread-data';
import { useAgentSelectionStore } from '@/lib/stores/agent-selection-store';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { toast } from 'sonner';

interface ThreadComponentProps {
  projectId?: string;
  threadId: string;
  compact?: boolean;
  configuredAgentId?: string; // When set, only allow selection of this specific agent
}

export function ThreadComponent({
  projectId,
  threadId,
  compact = false,
  configuredAgentId
}: ThreadComponentProps) {
  const isMobile = useIsMobile();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // State
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileToView, setFileToView] = useState<string | null>(null);
  const [filePathList, setFilePathList] = useState<string[] | undefined>(undefined);
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [initialPanelOpenAttempted, setInitialPanelOpenAttempted] = useState(false);

  // Use Zustand store for agent selection persistence
  const {
    selectedAgentId,
    setSelectedAgent,
  } = useAgentSelectionStore();

  const { data: agentsResponse } = useAgents();
  const agents = agentsResponse?.data || [];
  const [isSidePanelAnimating, setIsSidePanelAnimating] = useState(false);
  const [userInitiatedRun, setUserInitiatedRun] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Refs
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const initialLayoutAppliedRef = useRef(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Thread data
  const {
    threadQuery,
    projectQuery,
    agentRunsQuery,
    // messagesQuery,
    isLoading: threadDataLoading,
    error: threadDataError,
    initialLoadCompleted,
    projectName,
    sandboxId,
  } = useThreadData(threadId, projectId || '');

  // Mutations
  // const addUserMessageMutation = useAddUserMessageMutation();

  // Initialize agent selection
  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      // Simple initialization - just select the first agent
      setSelectedAgent(agents[0].id);
    }
  }, [agents, selectedAgentId, setSelectedAgent]);

  // Handle sending messages
  // const handleSendMessage = useCallback(async (message: string, options?: {
  //   agent_id?: string;
  //   model_name?: string;
  // }) => {
  //   if (!message.trim() || isSending) return;

  //     setIsSending(true);
  //   try {
  //     await addUserMessageMutation.mutateAsync({
  //         threadId,
  //       content: message,
  //     });
  //     setNewMessage('');
  //   } catch (error) {
  //     console.error('Error sending message:', error);
  //     toast.error('Failed to send message');
  //     } finally {
  //       setIsSending(false);
  //     }
  // }, [threadId, isSending, addUserMessageMutation]);

  // Handle file viewer
  const handleOpenFileViewer = useCallback((filePath?: string, filePathList?: string[]) => {
      if (filePath) {
        setFileToView(filePath);
      setFileViewerOpen(true);
      }
    if (filePathList) {
      setFilePathList(filePathList);
    }
  }, []);

  // Loading state
  if (threadQuery.isLoading) {
    return <ThreadSkeleton isSidePanelOpen={false} />;
  }

  // Error state
  if (threadQuery.isError || !threadQuery.data) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <h2 className="text-xl font-semibold mb-2">Thread not found</h2>
        <p className="text-muted-foreground text-center">
          The thread you're looking for doesn't exist or you don't have access to it.
        </p>
      </div>
    );
  }

  const thread = threadQuery.data;
  const project = projectQuery.data;
  // Use projectName from hook instead of calculating it

  // Compact version for embedded use
  if (compact) {
    return (
      <div className="flex flex-col h-full">
        <div className="border-b p-4">
          <h1 className="text-2xl font-bold">{thread.title}</h1>
          <p className="text-muted-foreground">{thread.description || 'No description'}</p>
        </div>

        <div className="flex-1 p-4">
          <div className="bg-muted rounded-lg p-8 text-center">
            <h3 className="text-lg font-semibold mb-2">Thread Content Coming Soon</h3>
            <p className="text-muted-foreground">
              Full thread functionality will be implemented here.
            </p>
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Thread ID: {threadId}</p>
              {projectId && <p>Project ID: {projectId}</p>}
          </div>
            </div>
          </div>
        </div>
    );
  }

  // Full layout version for dedicated thread pages
  return (
      <ThreadLayout
        threadId={threadId}
        projectName={projectName}
      projectId={projectId || ''}
        debugMode={debugMode}
      compact={false}
      >
      <div className="flex flex-col h-full">
        {/* Content */}
        <div className="flex-1 overflow-hidden">
        <ThreadContent
            messages={[]} // TODO: Implement messages
            agentStatus="idle"
            handleToolClick={() => { }}
          handleOpenFileViewer={handleOpenFileViewer}
          readOnly={false}
            sandboxId={undefined}
            project={project as any}
          debugMode={debugMode}
            agentName="Assistant"
          />
        </div>

        {/* Chat Input */}
        {/* <div className="border-t p-4">
            <ChatInput
              value={newMessage}
              onChange={setNewMessage}
              onSubmit={(message, options) => handleSendMessage(message, options)}
              disabled={isSending}
              placeholder="Type your message..."
              selectedAgentId={selectedAgentId || undefined}
              onAgentSelect={(agentId) => setSelectedAgent(agentId || undefined)}
            />
          </div> */}
        </div>
      </ThreadLayout>
  );
}