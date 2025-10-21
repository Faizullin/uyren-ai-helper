'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAgents } from '@/hooks/use-agents';
import { useAgentSelection } from '@/lib/stores/agent-selection-store';
import { cn } from '@/lib/utils';
import { Loader2, Mic, Paperclip, Send, Settings, X } from 'lucide-react';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

export interface ChatInputHandles {
  clearPendingFiles: () => void;
  getPendingFiles: () => File[];
}

export interface ChatInputProps {
  onSubmit: (message: string, options?: { agent_id?: string; model_name?: string }) => void;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  selectedAgentId?: string;
  onAgentSelect?: (agentId: string | null) => void;
  enableAdvancedConfig?: boolean;
  onConfigureAgent?: (agentId: string) => void;
  selectedMode?: string | null;
  onModeDeselect?: () => void;
  animatePlaceholder?: boolean;
}

export const ChatInput = forwardRef<ChatInputHandles, ChatInputProps>(
  (
    {
      onSubmit,
      placeholder = 'Describe what you need help with...',
      loading = false,
      disabled = false,
      autoFocus = true,
      value: controlledValue,
      onChange: controlledOnChange,
      selectedAgentId,
      onAgentSelect,
      enableAdvancedConfig = false,
      onConfigureAgent,
      selectedMode,
      onModeDeselect,
      animatePlaceholder = false,
    },
    ref,
  ) => {
    const isControlled = controlledValue !== undefined && controlledOnChange !== undefined;
    const [uncontrolledValue, setUncontrolledValue] = useState('');
    const value = isControlled ? controlledValue : uncontrolledValue;
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    
    const { data: agents } = useAgents();
    const { getCurrentAgent } = useAgentSelection();
    const selectedAgent = selectedAgentId ? getCurrentAgent(agents?.data || []) : null;

    useImperativeHandle(ref, () => ({
      clearPendingFiles: () => setPendingFiles([]),
      getPendingFiles: () => pendingFiles,
    }));

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (isControlled) {
        controlledOnChange?.(newValue);
      } else {
        setUncontrolledValue(newValue);
      }
    };

    const handleSubmit = useCallback(() => {
      if ((!value.trim() && pendingFiles.length === 0) || loading || disabled) return;
      
      onSubmit(value.trim(), {
        agent_id: selectedAgentId || undefined,
      });
    }, [value, pendingFiles.length, loading, disabled, onSubmit, selectedAgentId]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      setPendingFiles(prev => [...prev, ...files]);
    };

    const removeFile = (index: number) => {
      setPendingFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingOver(false);
      const files = Array.from(e.dataTransfer.files);
      setPendingFiles(prev => [...prev, ...files]);
    };

    const animatedPlaceholder = animatePlaceholder 
      ? placeholder.split('').map((char, i) => (
          <span key={i} style={{ animationDelay: `${i * 0.05}s` }}>{char}</span>
        ))
      : placeholder;

    return (
      <div className="relative w-full max-w-3xl mx-auto">
        <div 
          className={cn(
            "relative bg-card border rounded-2xl shadow-lg p-4 transition-colors",
            isDraggingOver && "border-primary/50 bg-primary/5"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Agent Selection */}
          {selectedAgent && (
            <div className="flex items-center gap-2 mb-2">
              <div className="flex items-center gap-2 px-2 py-1 bg-accent/50 rounded-lg text-xs">
                <span className="text-muted-foreground">Agent:</span>
                <span className="font-medium">{selectedAgent.name}</span>
                {onModeDeselect && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onModeDeselect}
                    className="h-4 w-4 p-0 hover:bg-destructive/20"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* File Attachments */}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {pendingFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-1 px-2 py-1 bg-accent/50 rounded-lg text-xs">
                  <Paperclip className="h-3 w-3" />
                  <span className="truncate max-w-[100px]">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-4 w-4 p-0 hover:bg-destructive/20"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={typeof animatedPlaceholder === 'string' ? animatedPlaceholder : undefined}
            className={cn(
              'w-full bg-transparent border-none shadow-none focus-visible:ring-0 px-0 pb-0 pt-2 text-[15px] min-h-[60px] max-h-[200px] overflow-y-auto resize-none',
              'placeholder:text-muted-foreground/60'
            )}
            disabled={loading || disabled}
            rows={1}
            autoFocus={autoFocus}
          />
          
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <input
                type="file"
                id="file-upload"
                className="hidden"
                multiple
                onChange={handleFileUpload}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => document.getElementById('file-upload')?.click()}
                className="h-8 w-8 p-0"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                <Mic className="h-4 w-4" />
              </Button>
              {enableAdvancedConfig && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
            
            <Button
              onClick={handleSubmit}
              disabled={(!value.trim() && pendingFiles.length === 0) || loading || disabled}
              size="sm"
              className="rounded-xl px-4 py-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';
