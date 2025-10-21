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
import { Textarea } from '@/components/ui/textarea';
import { useCreateAgent } from '@/hooks/use-agents';
import { toast } from 'sonner';
import { IUseDialogControl, useDialogControl } from '@/hooks/use-dialog-control';
import { HelpCircle } from 'lucide-react';
import { ModelsHelperDialog } from './models-helper-dialog';

interface NewAgentDialogProps {
  control: IUseDialogControl;
}

export function NewAgentDialog({ control }: NewAgentDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('anthropic/claude-3-5-sonnet-latest');
  
  const modelsHelperDialog = useDialogControl();
  const createAgent = useCreateAgent();

  const handleModelSelect = (selectedModel: string) => {
    setModel(selectedModel);
    modelsHelperDialog.hide();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast.error('Please provide a name for the agent');
      return;
    }

    try {
      await createAgent.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
        model,
      });

      // Reset form
      setName('');
      setDescription('');
      setSystemPrompt('');
      setModel('anthropic/claude-3-5-sonnet-latest');
      
      control.hide();
      toast.success('Agent created successfully!');
    } catch (error) {
      toast.error('Failed to create agent');
    }
  };

  return (
    <Dialog open={control.isVisible} onOpenChange={control.toggle}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription>
              Create a new AI agent with custom configuration
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Agent"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this agent do?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <div className="flex gap-2">
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="anthropic/claude-3-5-sonnet-latest"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={modelsHelperDialog.show}
                  title="View available models"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="You are a helpful assistant..."
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={control.hide}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createAgent.isPending || !name.trim()}>
              {createAgent.isPending ? 'Creating...' : 'Create Agent'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <ModelsHelperDialog
        control={modelsHelperDialog}
        onModelSelect={handleModelSelect}
      />
    </Dialog>
  );
}
