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
import { Crown, AlertTriangle } from 'lucide-react';
import { IUseDialogControl } from '@/hooks/use-dialog-control';

interface AgentLimitData {
  current_count: number;
  limit: number;
  tier_name: string;
}

interface AgentCountLimitDialogProps {
  control: IUseDialogControl<AgentLimitData>;
}

export function AgentCountLimitDialog({
  control,
}: AgentCountLimitDialogProps) {
  const data = control.data;

  if (!data) return null;

  return (
    <Dialog open={control.isVisible} onOpenChange={control.toggle}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <DialogTitle>Agent Limit Reached</DialogTitle>
              <DialogDescription>
                You've reached the maximum number of agents for your current plan
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Current Usage</span>
              <Badge variant="outline" className="text-xs">
                {data.tier_name}
              </Badge>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Agents</span>
                <span className="font-medium">
                  {data.current_count} / {data.limit}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${(data.current_count / data.limit) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>
              You can create more agents by upgrading your plan or deleting existing agents 
              to free up space.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={control.hide}
            className="w-full sm:w-auto"
          >
            Close
          </Button>
          <Button className="w-full sm:w-auto">
            <Crown className="h-4 w-4 mr-2" />
            Upgrade Plan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
