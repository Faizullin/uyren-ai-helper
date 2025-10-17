'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, Star } from 'lucide-react';
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

interface StreamlinedInstallDialogProps {
  control: IUseDialogControl<MarketplaceTemplate>;
  onInstall: (
    item: MarketplaceTemplate,
    instanceName?: string,
    profileMappings?: Record<string, string>,
    customMcpConfigs?: Record<string, Record<string, any>>,
    triggerConfigs?: Record<string, Record<string, any>>,
    triggerVariables?: Record<string, Record<string, string>>
  ) => void;
  isInstalling: boolean;
}

export function StreamlinedInstallDialog({
  control,
  onInstall,
  isInstalling,
}: StreamlinedInstallDialogProps) {
  const [instanceName, setInstanceName] = useState('');
  const item = control.data;

  if (!item) return null;

  const handleInstall = () => {
    onInstall(item, instanceName);
  };

  const handleClose = () => {
    setInstanceName('');
    control.hide();
  };

  return (
    <Dialog open={control.isVisible} onOpenChange={control.toggle}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-primary">
                {item.name.charAt(0)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg">{item.name}</DialogTitle>
              <DialogDescription className="mt-1">
                by {item.creator_name}
                {item.is_kortix_team && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    <Star className="h-3 w-3 mr-1" />
                    Official
                  </Badge>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {item.description}
          </p>

          <div className="space-y-2">
            <Label htmlFor="instanceName">Agent Name *</Label>
            <Input
              id="instanceName"
              value={instanceName}
              onChange={(e) => setInstanceName(e.target.value)}
              placeholder={`${item.name} Instance`}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Choose a name for your agent instance
            </p>
          </div>

          {item.tags.length > 0 && (
            <div>
              <Label className="text-sm font-medium">Tags</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {item.tags.slice(0, 5).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {item.tags.length > 5 && (
                  <Badge variant="secondary" className="text-xs">
                    +{item.tags.length - 5}
                  </Badge>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={control.hide}
            className="w-full sm:w-auto"
            disabled={isInstalling}
          >
            Cancel
          </Button>
          <Button
            onClick={handleInstall}
            disabled={isInstalling || !instanceName.trim()}
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
