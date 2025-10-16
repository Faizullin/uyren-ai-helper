'use client';

import { useState, useEffect } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Agent, useUpdateAgent } from '@/hooks/use-agents';

interface EditAgentDialogProps {
  agent: Agent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function EditAgentDialog({
  agent,
  open,
  onOpenChange,
  onSuccess,
}: EditAgentDialogProps) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description || '');
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt || '');
  const [model, setModel] = useState(agent.model || 'anthropic/claude-3-7-sonnet-latest');
  
  const updateAgent = useUpdateAgent();

  useEffect(() => {
    if (open) {
      setName(agent.name);
      setDescription(agent.description || '');
      setSystemPrompt(agent.system_prompt || '');
      setModel(agent.model || 'anthropic/claude-3-7-sonnet-latest');
    }
  }, [open, agent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await updateAgent.mutateAsync({
      agentId: agent.agent_id,
      name,
      description,
      system_prompt: systemPrompt,
      model,
    });
    
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Agent</DialogTitle>
            <DialogDescription>
              Update your agent&apos;s configuration
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateAgent.isPending || !name}>
              {updateAgent.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

