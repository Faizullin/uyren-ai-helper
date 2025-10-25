import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDismiss: () => void;
}

export function UpgradeDialog({ open, onOpenChange, onDismiss }: UpgradeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            Upgrade to Premium
          </DialogTitle>
          <DialogDescription>
            Unlock advanced features and remove limitations with our premium plan.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Premium features include:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Unlimited agent runs</li>
              <li>Advanced AI models</li>
              <li>Priority support</li>
              <li>Custom integrations</li>
            </ul>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={onDismiss} variant="outline" className="flex-1">
              Maybe Later
            </Button>
            <Button className="flex-1">
              Upgrade Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
