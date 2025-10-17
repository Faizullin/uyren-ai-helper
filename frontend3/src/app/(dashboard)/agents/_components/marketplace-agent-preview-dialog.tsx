'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Star, Users, Calendar, Code } from 'lucide-react';
import { IUseDialogControl } from '@/hooks/use-dialog-control';

interface MarketplaceTemplate {
  id: string;
  creator_id: string;
  name: string;
  description: string;
  system_prompt: string;
  tags: string[];
  download_count: number;
  creator_name: string;
  created_at: string;
  template_id: string;
  is_kortix_team: boolean;
}

interface MarketplaceAgentPreviewDialogProps {
  control: IUseDialogControl<MarketplaceTemplate>;
  onInstall: (agent: MarketplaceTemplate) => void;
  isInstalling: boolean;
}

export function MarketplaceAgentPreviewDialog({
  control,
  onInstall,
  isInstalling,
}: MarketplaceAgentPreviewDialogProps) {
  const agent = control.data;

  if (!agent) return null;

  return (
    <Dialog open={control.isVisible} onOpenChange={control.toggle}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-semibold text-primary">
                {agent.name.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl">{agent.name}</DialogTitle>
              <DialogDescription className="mt-1">
                by {agent.creator_name}
                {agent.is_kortix_team && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Official
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {agent.description}
            </p>
          </div>

          {/* Tags */}
          {agent.tags.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {agent.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* System Prompt */}
          <div>
            <h3 className="font-semibold mb-2">System Prompt</h3>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Code className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">PROMPT</span>
              </div>
              <p className="text-sm leading-relaxed font-mono whitespace-pre-wrap">
                {agent.system_prompt}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Download className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Downloads:</span>
              <span className="font-medium">{agent.download_count.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Created:</span>
              <span className="font-medium">
                {new Date(agent.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={control.hide}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
          <Button
            onClick={() => onInstall(agent)}
            disabled={isInstalling}
            className="w-full sm:w-auto"
          >
            {isInstalling ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                Installing...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Install Agent
              </div>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
