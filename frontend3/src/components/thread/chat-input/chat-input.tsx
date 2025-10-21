'use client';

import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
  useMemo,
  memo,
} from 'react';
import { useAgents } from '@/hooks/use-agents';
import { useAgentSelection } from '@/lib/stores/agent-selection-store';
import { useModelStore } from '@/lib/stores/model-store';

import { Card, CardContent } from '@/components/ui/card';
import { handleFiles, FileUploadHandler } from './file-upload-handler';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2, ArrowUp, X, Paperclip, StopCircle } from 'lucide-react';
import { VoiceRecorder } from './voice-recorder';
import { UnifiedConfigMenu } from './unified-config-menu';
import { AttachmentGroup } from '../attachment-group';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';
import { ToolCallInput } from './floating-tool-preview';

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
      { id: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'anthropic/claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
      { id: 'anthropic/claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
      { id: 'openai/gpt-4o', label: 'GPT-4o' },
      { id: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
    ], []);

    const handleModelChange = (modelId: string) => setSelectedModel(modelId);
    const canAccessModel = () => true;
    const getActualModelId = (modelId: string) => modelId;

    const selectedAgent = agents.find((agent: any) => agent.id === selectedAgentId);
    const { initializeFromAgents } = useAgentSelection();

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
          await handleFiles(
            files,
            sandboxId,
            setPendingFiles,
            setUploadedFiles,
            setIsUploading,
            messages,
            queryClient
          );
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
          subscriptionStatus="active"
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
                  placeholder={placeholder}
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
                              await handleFiles(
                                files,
                                sandboxId,
                                setPendingFiles,
                                setUploadedFiles,
                                setIsUploading,
                                messages,
                                queryClient
                              );
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

