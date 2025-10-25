'use client';

import { ChatInput, ChatInputHandles } from '@/components/thread/chat-input/chat-input';
import { useAgents } from '@/hooks/use-agents';
import { useDashboardTour } from '@/hooks/use-dashboard-tour';
import { useInitiateAgentMutation } from '@/hooks/use-initiate-agent';
import { useIsMobile } from '@/hooks/use-mobile';
import { useThread } from '@/hooks/use-threads';
import { useAgentSelectionStore } from '@/lib/stores/agent-selection-store';
import { cn } from '@/lib/utils';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { SunaModesPanel } from './modes-panel';


const PENDING_PROMPT_KEY = 'pendingAgentPrompt';

const dashboardTourSteps = [
  {
    target: '[data-tour="chat-input"]',
    content: 'Type your questions or tasks here. AI Helper can help with research, analysis, automation, and much more.',
    title: 'Start a Conversation',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '[data-tour="my-agents"]',
    content: 'Create and manage your custom AI agents here. Build specialized agents for different tasks and workflows.',
    title: 'Manage Your Agents',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: '[data-tour="examples"]',
    content: 'Get started quickly with these example prompts. Click any example to try it out.',
    title: 'Example Prompts',
    placement: 'top',
    disableBeacon: true,
  },
];

export function DashboardContent() {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [autoSubmit, setAutoSubmit] = useState(false);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'super-worker' | 'worker-templates'>('super-worker');
  const [selectedCharts, setSelectedCharts] = useState<string[]>([]);
  const [selectedOutputFormat, setSelectedOutputFormat] = useState<string | null>(null);

  const chatInputRef = useRef<ChatInputHandles>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [initiatedThreadId, setInitiatedThreadId] = useState<string | null>(null);

  const {
    selectedAgentId,
    setSelectedAgent,
    initializeFromAgents,
    getCurrentAgent,
    isSunaAgent
  } = useAgentSelectionStore();

  const { data: agents } = useAgents();
  const initiateAgentMutation = useInitiateAgentMutation();
  const threadQuery = useThread(initiatedThreadId || '');

  // Tour integration
  const {
    run,
    stepIndex,
    setStepIndex,
    stopTour,
    showWelcome,
    handleWelcomeAccept,
    handleWelcomeDecline,
  } = useDashboardTour();

  const agentsList = agents?.data || [];
  const selectedAgent = getCurrentAgent(agentsList);
  const displayName = selectedAgent?.name || 'AI Helper';
  const isSunaAgentSelected = isSunaAgent(agentsList);

  // Initialize agents when they're loaded
  useEffect(() => {
    if (agentsList.length > 0) {
      initializeFromAgents(agentsList, undefined, setSelectedAgent);
    }
  }, [agentsList, initializeFromAgents, setSelectedAgent]);

  // Handle URL parameters for view mode
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'worker-templates') {
      setViewMode('worker-templates');
    } else {
      setViewMode('super-worker');
    }
  }, [searchParams]);

  // Handle URL parameters for agent selection
  useEffect(() => {
    const agentIdFromUrl = searchParams.get('agent_id');
    if (agentIdFromUrl && agentIdFromUrl !== selectedAgentId) {
      setSelectedAgent(agentIdFromUrl);
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('agent_id');
      router.replace(newUrl.pathname + newUrl.search, { scroll: false });
    }
  }, [searchParams, selectedAgentId, router, setSelectedAgent]);

  // Reset data selections when mode changes
  useEffect(() => {
    if (selectedMode !== 'data') {
      setSelectedCharts([]);
      setSelectedOutputFormat(null);
    }
  }, [selectedMode]);

  const handleTourCallback = useCallback((data: any) => {
    const { status, type, index } = data;

    if (status === 'finished' || status === 'skipped') {
      stopTour();
    } else if (type === 'step:after') {
      setStepIndex(index + 1);
    }
  }, [stopTour, setStepIndex]);

  const handleSubmit = async (
    message: string,
    options?: {
      agent_id?: string;
      model_name?: string;
    },
  ) => {
    if (
      (!message.trim() && !chatInputRef.current?.getPendingFiles().length) ||
      isSubmitting ||
      isRedirecting
    )
      return;

    setIsSubmitting(true);

    try {
      const files = chatInputRef.current?.getPendingFiles() || [];
      localStorage.removeItem(PENDING_PROMPT_KEY);

      const result = await initiateAgentMutation.mutateAsync({
        data: {
          prompt: message,
          agent_id: selectedAgentId,
          files: files,
          model_name: options?.model_name,
        },
      });

      if (result.thread_id) {
        setInitiatedThreadId(result.thread_id);
        // Don't reset isSubmitting here - keep loading until redirect happens
      } else {
        throw new Error('Agent initiation did not return a thread_id.');
      }

      chatInputRef.current?.clearPendingFiles();
    } catch (error: any) {
      console.error('Error submitting message:', error);
      toast.error(error?.message || 'Failed to start conversation');
      setIsSubmitting(false);
    }
  };

  // Handle pending prompts from localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      const pendingPrompt = localStorage.getItem(PENDING_PROMPT_KEY);

      if (pendingPrompt) {
        setInputValue(pendingPrompt);
        setAutoSubmit(true);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  // Auto-submit pending prompts
  useEffect(() => {
    if (autoSubmit && inputValue && !isSubmitting && !isRedirecting) {
      const timer = setTimeout(() => {
        handleSubmit(inputValue);
        setAutoSubmit(false);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [autoSubmit, inputValue, isSubmitting, isRedirecting]);

  // Redirect to thread when initiated and loaded
  useEffect(() => {
    if (threadQuery.data && initiatedThreadId) {
      const thread = threadQuery.data;
      setIsRedirecting(true);

      if (thread.project_id) {
        router.push(`/projects/${thread.project_id}/threads/${initiatedThreadId}`);
      } else {
        router.push(`/agents/threads/${initiatedThreadId}`);
      }

      setInitiatedThreadId(null);
    }
  }, [threadQuery.data, initiatedThreadId, router]);

  const handleModeSelect = (mode: string | null) => {
    setSelectedMode(mode);
  };

  const handleSelectPrompt = (prompt: string) => {
    setInputValue(prompt);
  };

  // Reset data selections when mode changes
  useEffect(() => {
    if (selectedMode !== 'data') {
      setSelectedCharts([]);
      setSelectedOutputFormat(null);
    }
  }, [selectedMode]);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex flex-col">
          {/* Tabs at the top */}
          <div className="px-4 pt-4 pb-4">
            <div className="flex items-center justify-center gap-2 p-1 bg-muted/50 rounded-xl w-fit mx-auto">
              <button
                onClick={() => {
                  setViewMode('super-worker');
                  setSelectedMode(null);
                  router.push('/dashboard');
                }}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  viewMode === 'super-worker'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                AI Helper Super Worker
              </button>
              <button
                onClick={() => {
                  setViewMode('worker-templates');
                  setSelectedMode(null);
                  router.push('/dashboard?tab=worker-templates');
                }}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                  viewMode === 'worker-templates'
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Worker Templates
              </button>
            </div>
          </div>

          {/* Centered content area */}
          <div className="flex-1 flex items-start justify-center pt-[20vh]">
            {/* Super Worker View */}
            {viewMode === 'super-worker' && (
              <div className="w-full animate-in fade-in-0 duration-300">
                {/* Title and chat input - Fixed position */}
                <div className="px-4 py-8">
                  <div className="w-full max-w-3xl mx-auto flex flex-col items-center space-y-4 md:space-y-6">
                    <div className="flex flex-col items-center text-center w-full">
                      <p
                        className="tracking-tight text-2xl md:text-3xl font-normal text-foreground/90"
                        data-tour="dashboard-title"
                      >
                        What should {displayName} do for you today?
                      </p>
                    </div>

                    <div className="w-full" data-tour="chat-input">
                      <ChatInput
                        ref={chatInputRef}
                        onSubmit={handleSubmit}
                        loading={isSubmitting || isRedirecting}
                        placeholder="Describe what you need help with..."
                        value={inputValue}
                        onChange={setInputValue}
                        hideAttachments={false}
                        selectedAgentId={selectedAgentId || undefined}
                        onAgentSelect={(agentId) => setSelectedAgent(agentId || undefined)}
                        enableAdvancedConfig={false}
                        selectedMode={selectedMode}
                        onModeDeselect={() => setSelectedMode(null)}
                        animatePlaceholder={true}
                        selectedCharts={selectedCharts}
                        selectedOutputFormat={selectedOutputFormat}
                      />
                    </div>
                  </div>
                </div>

                {/* Modes Panel - Below chat input */}
                {isSunaAgentSelected && (
                  <div className="px-4 pb-8" data-tour="examples">
                    <div className="max-w-3xl mx-auto">
                      <SunaModesPanel
                        selectedMode={selectedMode}
                        onModeSelect={handleModeSelect}
                        onSelectPrompt={handleSelectPrompt}
                        isMobile={isMobile}
                        selectedCharts={selectedCharts}
                        onChartsChange={setSelectedCharts}
                        selectedOutputFormat={selectedOutputFormat}
                        onOutputFormatChange={setSelectedOutputFormat}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Worker Templates View - Simplified without templates */}
            {viewMode === 'worker-templates' && (
              <div className="w-full animate-in fade-in-0 duration-300">
                <div className="w-full px-4 pb-8" data-tour="custom-agents">
                  <div className="max-w-5xl mx-auto">
                    <div className="text-center py-8">
                      <h2 className="text-2xl font-semibold mb-4">Worker Templates</h2>
                      <p className="text-muted-foreground">
                        Worker templates feature coming soon
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
