'use client';

import React from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ModelOption {
  id: string;
  label: string;
  requiresSubscription?: boolean;
}

interface AgentModelSelectorProps {
  value?: string;
  onChange: (model: string) => void;
  disabled?: boolean;
  variant?: 'default' | 'menu-item';
  className?: string;
  modelOptions?: ModelOption[];
}

export function AgentModelSelector({
  value,
  onChange,
  disabled = false,
  variant = 'default',
  className,
  modelOptions = [
    { id: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { id: 'anthropic/claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
    { id: 'anthropic/claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
    { id: 'openai/gpt-4o', label: 'GPT-4o' },
    { id: 'google/gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
  ],
}: AgentModelSelectorProps) {
  const selectedModel = modelOptions.find(model => model.id === value) || modelOptions[0];

  if (variant === 'menu-item') {
    return (
      <DropdownMenuItem
        onClick={() => onChange(selectedModel.id)}
        className={cn("flex items-center justify-between", className)}
      >
        <span>{selectedModel.label}</span>
        <Check className="h-4 w-4" />
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn("justify-between", className)}
        >
          <span>{selectedModel.label}</span>
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {modelOptions.map((model) => (
          <DropdownMenuItem
            key={model.id}
            onClick={() => onChange(model.id)}
            className="flex items-center justify-between"
          >
            <span>{model.label}</span>
            {model.id === value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
