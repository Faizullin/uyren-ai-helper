'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { IUseDialogControl } from '@/hooks/use-dialog-control';
import { Check, Sparkles, Zap, DollarSign } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ModelsHelperDialogProps {
  control: IUseDialogControl;
  onModelSelect: (model: string) => void;
}

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  description: string;
  tier: 'free' | 'paid';
  recommended?: boolean;
  contextWindow?: string;
}

const AVAILABLE_MODELS: ModelInfo[] = [
  {
    id: 'anthropic/claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    description: 'Latest Claude model with excellent reasoning and coding capabilities',
    tier: 'paid',
    recommended: true,
    contextWindow: '200K',
  },
  {
    id: 'anthropic/claude-3-5-sonnet-latest',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description: 'Powerful model with strong coding and analysis capabilities',
    tier: 'paid',
    recommended: true,
    contextWindow: '200K',
  },
  {
    id: 'anthropic/claude-3-5-haiku-latest',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    description: 'Fast and efficient model for quick responses',
    tier: 'paid',
    contextWindow: '200K',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'OpenAI\'s flagship multimodal model',
    tier: 'paid',
    contextWindow: '128K',
  },
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    description: 'Smaller, faster version of GPT-4o',
    tier: 'paid',
    contextWindow: '128K',
  },
  {
    id: 'google/gemini-2.0-flash-exp',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    description: 'Fast and capable multimodal model',
    tier: 'free',
    contextWindow: '1M',
  },
  {
    id: 'moonshotai/kimi-k2',
    name: 'Kimi K2',
    provider: 'Moonshot AI',
    description: 'Free model with good performance',
    tier: 'free',
    contextWindow: '128K',
  },
  {
    id: 'xai/grok-2-latest',
    name: 'Grok 2',
    provider: 'xAI',
    description: 'Advanced reasoning model',
    tier: 'paid',
    contextWindow: '128K',
  },
];

export function ModelsHelperDialog({ control, onModelSelect }: ModelsHelperDialogProps) {
  return (
    <Dialog open={control.isVisible} onOpenChange={control.toggle}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Available Models</DialogTitle>
          <DialogDescription>
            Select a model to use for your agent. Free models are available to all users, 
            while paid models require an active subscription.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {AVAILABLE_MODELS.map((model) => (
              <div
                key={model.id}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
                onClick={() => onModelSelect(model.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{model.name}</h4>
                      {model.recommended && (
                        <Badge variant="default" className="text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Recommended
                        </Badge>
                      )}
                      <Badge 
                        variant={model.tier === 'free' ? 'secondary' : 'outline'}
                        className="text-xs"
                      >
                        {model.tier === 'free' ? (
                          <><Zap className="h-3 w-3 mr-1" />Free</>
                        ) : (
                          <><DollarSign className="h-3 w-3 mr-1" />Paid</>
                        )}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {model.provider}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {model.description}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onModelSelect(model.id);
                    }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                  <span>Context: {model.contextWindow}</span>
                  <code className="bg-muted px-2 py-0.5 rounded text-xs">
                    {model.id}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

