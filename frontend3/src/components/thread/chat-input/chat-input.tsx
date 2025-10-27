'use client';

import { useAgents } from '@/hooks/use-agents';
import { useAgentSelectionStore } from '@/lib/stores/agent-selection-store';
import { useModelStore } from '@/lib/stores/model-store';
import React, {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, BarChart3, Code2, FileText, Image as ImageIcon, Loader2, Paperclip, Presentation, Search, StopCircle, Users, X } from 'lucide-react';
import { AttachmentGroup } from '../attachment-group';
// import { handleFiles } from './file-upload-handler';
import { ToolCallInput } from './floating-tool-preview';
import { UnifiedConfigMenu } from './unified-config-menu';
import { VoiceRecorder } from './voice-recorder';

// Helper function to get the icon for each mode
const getModeIcon = (mode: string) => {
  const iconClass = "w-4 h-4";
  switch (mode) {
    case 'research':
      return <Search className={iconClass} />;
    case 'people':
      return <Users className={iconClass} />;
    case 'code':
      return <Code2 className={iconClass} />;
    case 'docs':
      return <FileText className={iconClass} />;
    case 'data':
      return <BarChart3 className={iconClass} />;
    case 'slides':
      return <Presentation className={iconClass} />;
    case 'image':
      return <ImageIcon className={iconClass} />;
    default:
      return null;
  }
};

export interface ChatInputHandles {
  getPendingFiles: () => File[];
  clearPendingFiles: () => void;
}

// Uploaded file interface
export interface UploadedFile {
  name: string;
  path: string;
  size: number;
  type: string;
  localUrl?: string;
}

export interface ChatInputProps {
  onSubmit: (
    message: string,
    options?: {
      model_name?: string;
      agent_id?: string;
    },
  ) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  isAgentRunning?: boolean;
  onStopAgent?: () => void;
  autoFocus?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onFileBrowse?: () => void;
  sandboxId?: string;
  hideAttachments?: boolean;
  selectedAgentId?: string;
  onAgentSelect?: (agentId: string | undefined) => void;
  agentName?: string;
  messages?: any[];
  bgColor?: string;
  toolCalls?: ToolCallInput[];
  toolCallIndex?: number;
  showToolPreview?: boolean;
  isLoggedIn?: boolean;
  hideAgentSelection?: boolean;
  enableAdvancedConfig?: boolean;
  selectedMode?: string | null;
  onModeDeselect?: () => void;
  animatePlaceholder?: boolean;
  selectedCharts?: string[];
  selectedOutputFormat?: string | null;
}

export const ChatInput = memo(forwardRef<ChatInputHandles, ChatInputProps>(
  (
    {
      onSubmit,
      placeholder = 'Describe what you need help with...',
      loading = false,
      disabled = false,
      isAgentRunning = false,
      onStopAgent,
      autoFocus = true,
      value: controlledValue,
      onChange: controlledOnChange,
      onFileBrowse,
      sandboxId,
      hideAttachments = false,
      selectedAgentId,
      onAgentSelect,
      agentName,
      messages = [],
      bgColor = 'bg-card',
      isLoggedIn = true,
      hideAgentSelection = false,
      enableAdvancedConfig = false,
      selectedMode,
      onModeDeselect,
      animatePlaceholder = false,
      selectedCharts = [],
      selectedOutputFormat = null,
      ...unusedProps // Accept unused props for compatibility
    },
    ref,
  ) => {
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [uncontrolledValue, setUncontrolledValue] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
    const [isModeDismissing, setIsModeDismissing] = useState(false);
    
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    // Use Zustand stores directly
    const { selectedModel, setSelectedModel } = useModelStore();
    const loadAgentsQuery = useAgents({ limit: 100 });
    const agents = loadAgentsQuery.data?.data || [];

    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : uncontrolledValue;

    // Simple model options
    const modelOptions = useMemo(() => [
      { id: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4', requiresSubscription: false },
      { id: 'anthropic/claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet', requiresSubscription: false },
      { id: 'anthropic/claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku', requiresSubscription: false },
      { id: 'openai/gpt-4o', label: 'GPT-4o', requiresSubscription: false },
      { id: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash', requiresSubscription: false },
    ], []);

    const handleModelChange = (modelId: string) => setSelectedModel(modelId);
    const canAccessModel = () => true;
    const getActualModelId = (modelId: string) => modelId;

    const selectedAgent = agents.find((agent: any) => agent.id === selectedAgentId);
    const { initializeFromAgents } = useAgentSelectionStore();

    useImperativeHandle(ref, () => ({
      getPendingFiles: () => pendingFiles,
      clearPendingFiles: () => setPendingFiles([]),
    }));

    useEffect(() => {
      setMounted(true);
    }, []);

    // Auto-resize textarea
    useEffect(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
      }
    }, [value]);

    // Auto-focus
    useEffect(() => {
      if (autoFocus && textareaRef.current) {
        textareaRef.current.focus();
      }
    }, [autoFocus]);

    // Animated placeholder effect
    useEffect(() => {
      if (!mounted || value || !animatePlaceholder) {
        return;
      }

      const placeholderText = placeholder || 'Describe what you need help with...';
      let currentIndex = 0;
      setAnimatedPlaceholder('');

      const typingInterval = setInterval(() => {
        if (currentIndex < placeholderText.length) {
          setAnimatedPlaceholder(placeholderText.slice(0, currentIndex + 1));
          currentIndex++;
        } else {
          clearInterval(typingInterval);
        }
      }, 50); // 50ms per character

      return () => clearInterval(typingInterval);
    }, [mounted, placeholder, value, animatePlaceholder]);

    // Reset mode dismissing state when selectedMode changes
    useEffect(() => {
      setIsModeDismissing(false);
    }, [selectedMode]);

    // Generate Markdown for selected data options
    const generateDataOptionsMarkdown = useCallback(() => {
      if (selectedMode !== 'data' || (selectedCharts.length === 0 && !selectedOutputFormat)) {
        return '';
      }
      
      let markdown = '\n\n----\n\n**Data Visualization Requirements:**\n';
      
      if (selectedOutputFormat) {
        markdown += `\n- **Output Format:** ${selectedOutputFormat}`;
      }
      
      if (selectedCharts.length > 0) {
        markdown += '\n- **Preferred Charts:**';
        selectedCharts.forEach(chartId => {
          markdown += `\n  - ${chartId}`;
        });
      }
      
      return markdown;
    }, [selectedMode, selectedCharts, selectedOutputFormat]);

    // Handle mode deselection with animation
    const handleModeDeselect = useCallback(() => {
      setIsModeDismissing(true);
      setTimeout(() => {
        onModeDeselect?.();
        setIsModeDismissing(false);
      }, 200); // Match animation duration
    }, [onModeDeselect]);

    const handleSubmit = useCallback(async (e: React.FormEvent) => {
      e.preventDefault();
      if (
        (!value.trim() && uploadedFiles.length === 0) ||
        loading ||
        (disabled && !isAgentRunning) ||
        isUploading
      )
        return;

      if (isAgentRunning && onStopAgent) {
        onStopAgent();
        return;
      }

      let message = value;

      if (uploadedFiles.length > 0) {
        const fileInfo = uploadedFiles
          .map((file) => `[Uploaded File: ${file.path}]`)
          .join('\n');
        message = message ? `${message}\n\n${fileInfo}` : fileInfo;
      }
      
      // Add data options markdown if in data mode
      const dataOptionsMarkdown = generateDataOptionsMarkdown();
      if (dataOptionsMarkdown) {
        message += dataOptionsMarkdown;
      }

      const baseModelName = getActualModelId(selectedModel);

      onSubmit(message, {
        agent_id: selectedAgentId,
        model_name: baseModelName,
      });

      if (!isControlled) {
        setUncontrolledValue('');
      }

      setUploadedFiles([]);
    }, [value, uploadedFiles, loading, disabled, isAgentRunning, isUploading, onStopAgent, getActualModelId, selectedModel, onSubmit, selectedAgentId, isControlled]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (isControlled) {
        controlledOnChange?.(newValue);
      } else {
        setUncontrolledValue(newValue);
      }
    }, [isControlled, controlledOnChange]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit(e as any);
      }
    }, [handleSubmit]);

    const handleFileRemove = useCallback((index: number) => {
      setUploadedFiles(prev => prev.filter((_, i) => i !== index));
      setPendingFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);
    };

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      if (hideAttachments || !sandboxId) return;

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        setPendingFiles(prev => [...prev, ...files]);

        if (sandboxId) {
          // await handleFiles(
          //   files,
          //   sandboxId,
          //   setPendingFiles,
          //   setUploadedFiles,
          //   setIsUploading,
          //   messages,
          //   queryClient
          // );
        }
      }
    };

    const displayName = useMemo(() => {
      if (agentName) return agentName;
      const agent = agents.find((a: any) => a.id === selectedAgentId);
      return agent?.name || 'AI Assistant';
    }, [agentName, agents, selectedAgentId]);

    const renderConfigDropdown = useMemo(() => {
      if (!mounted || !isLoggedIn || hideAgentSelection) return null;

      return (
          <UnifiedConfigMenu
          selectedAgentId={selectedAgentId}
          onAgentSelect={onAgentSelect}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            modelOptions={modelOptions}
            canAccessModel={canAccessModel}
        />
      );
    }, [mounted, isLoggedIn, hideAgentSelection, selectedAgentId, onAgentSelect, selectedModel, handleModelChange, modelOptions]);

    return (
      <div
        className={cn("relative w-full", isDraggingOver && "ring-2 ring-primary")}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Card className={cn("border-none shadow-none", bgColor)}>
          <CardContent className="p-4">
            <div className="space-y-3">
              {/* File attachments */}
              {!hideAttachments && uploadedFiles.length > 0 && (
                <AttachmentGroup
                  files={uploadedFiles}
                  onRemove={handleFileRemove}
                  sandboxId={sandboxId}
                />
              )}

              <div className="relative">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
                  placeholder={animatePlaceholder && mounted ? animatedPlaceholder : placeholder}
                  disabled={disabled && !isAgentRunning}
          className={cn(
                    "min-h-[80px] max-h-[200px] resize-none pr-32 text-base",
                    "focus-visible:ring-1"
                  )}
                />

                <div className="absolute bottom-2 right-2 flex items-center gap-2">
                  {/* File upload button */}
                  {!hideAttachments && sandboxId && (
                    <>
                      <input
              ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length > 0) {
                            setPendingFiles(prev => [...prev, ...files]);
                            if (sandboxId) {
                              // await handleFiles(
                              //   files,
                              //   sandboxId,
                              //   setPendingFiles,
                              //   setUploadedFiles,
                              //   setIsUploading,
                              //   messages,
                              //   queryClient
                              // );
                            }
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={disabled || isUploading}
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                    </>
                  )}

                  {/* Voice recorder */}
                  {isLoggedIn && (
                    <VoiceRecorder
                      onTranscription={(text: string) => {
                        if (isControlled) {
                          controlledOnChange?.(value + ' ' + text);
                        } else {
                          setUncontrolledValue(prev => prev + ' ' + text);
                        }
                      }}
                      disabled={disabled || loading}
                    />
                  )}

                  {/* Config menu */}
          {renderConfigDropdown}

                  {/* Submit/Stop button */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="submit"
                          size="icon"
                          disabled={(disabled || loading) && !isAgentRunning}
                  className={cn(
                            "rounded-full h-10 w-10",
                            isAgentRunning ? "bg-destructive hover:bg-destructive/90" : ""
                          )}
                          onClick={handleSubmit}
                        >
                          {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : isAgentRunning ? (
                            <StopCircle className="h-5 w-5" />
                  ) : (
                    <ArrowUp className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
                      <TooltipContent>
                        {isAgentRunning ? 'Stop agent' : 'Send message'}
                </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

              {/* Mode display */}
              {(selectedMode || isModeDismissing) && onModeDeselect && (
                <div className="flex items-center justify-between">
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50 text-sm transition-all duration-200",
                    isModeDismissing && "opacity-0 scale-95"
                  )}>
                    {selectedMode && getModeIcon(selectedMode)}
                    <span className="text-sm">{selectedMode?.charAt(0).toUpperCase()}{selectedMode?.slice(1)}</span>
                        </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleModeDeselect}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
            </div>
          )}

              {/* Agent info display */}
              {isLoggedIn && !hideAgentSelection && (
                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>
                    Agent: <span className="font-medium">{displayName}</span>
                  </span>
                  <span>
                    Model: <span className="font-medium">
                      {selectedModel || 'anthropic/claude-3-5-sonnet-latest'}
                    </span>
                  </span>
                </div>
          )}
        </div>
          </CardContent>
        </Card>
      </div>
    );
  }
));

ChatInput.displayName = 'ChatInput';

