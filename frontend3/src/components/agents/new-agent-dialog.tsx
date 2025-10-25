'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface NewAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentCreated?: (agentId: string) => void;
}

export function NewAgentDialog({ open, onOpenChange, onAgentCreated }: NewAgentDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [agentInstructions, setAgentInstructions] = useState('');

  const handleCreateAgent = async () => {
    if (!agentName.trim()) {
      toast.error('Please enter an agent name');
      return;
    }

    setIsLoading(true);
    try {
      // TODO: Implement agent creation logic
      const newAgentId = 'agent-' + Date.now(); // Placeholder
      toast.success('Agent created successfully');
      onAgentCreated?.(newAgentId);
      onOpenChange(false);
      
      // Reset form
      setAgentName('');
      setAgentDescription('');
      setAgentInstructions('');
    } catch (error) {
      toast.error('Failed to create agent');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
    // Reset form
    setAgentName('');
    setAgentDescription('');
    setAgentInstructions('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Agent
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Agent Name *</Label>
            <Input
              id="agent-name"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Enter agent name"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-description">Description</Label>
            <Textarea
              id="agent-description"
              value={agentDescription}
              onChange={(e) => setAgentDescription(e.target.value)}
              placeholder="Enter agent description"
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-instructions">Instructions</Label>
            <Textarea
              id="agent-instructions"
              value={agentInstructions}
              onChange={(e) => setAgentInstructions(e.target.value)}
              placeholder="Enter detailed instructions for the agent"
              rows={6}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={handleCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCreateAgent} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Agent
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
