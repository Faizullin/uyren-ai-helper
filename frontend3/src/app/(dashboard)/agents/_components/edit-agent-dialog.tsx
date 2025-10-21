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
import { useAgent, useUpdateAgent } from '@/hooks/use-agents';
import { toast } from 'sonner';
import { IUseDialogControl, useDialogControl } from '@/hooks/use-dialog-control';
import { HelpCircle, Loader2 } from 'lucide-react';
import { ModelsHelperDialog } from './models-helper-dialog';

interface EditAgentDialogProps {
  control: IUseDialogControl<string>; // Agent ID
}

export function EditAgentDialog({ control }: EditAgentDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('anthropic/claude-3-5-sonnet-latest');
  
  const modelsHelperDialog = useDialogControl();
  const updateAgentMut = useUpdateAgent();

  // Load agent details when dialog opens
  const agentId = control.data;
  const loadAgentQuery = useAgent(agentId || '');
  const agent = loadAgentQuery.data;

  // Populate form when agent data loads
  useEffect(() => {
    if (control.isVisible && agent) {
      setName(agent.name || '');
      setDescription(agent.description || '');
      setSystemPrompt(agent.system_prompt || '');
      setModel(agent.model || 'anthropic/claude-3-5-sonnet-latest');
    }
  }, [control.isVisible, agent]);

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

    if (!agentId) {
      toast.error('Agent ID not found');
      return;
    }

    try {
      await updateAgentMut.mutateAsync({
        agentId,
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
        model,
      });

      control.hide();
      toast.success('Agent updated successfully!');
    } catch (error) {
      toast.error('Failed to update agent');
    }
  };

  const handleCancel = () => {
    // Reset form to original values
    if (agent) {
      setName(agent.name || '');
      setDescription(agent.description || '');
      setSystemPrompt(agent.system_prompt || '');
      setModel(agent.model || 'anthropic/claude-3-5-sonnet-latest');
    }
    control.hide();
  };

  return (
    <Dialog open={control.isVisible} onOpenChange={control.toggle}>
      <DialogContent className="sm:max-w-[600px]">
        {loadAgentQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Agent</DialogTitle>
              <DialogDescription>
                Update your agent&apos;s configuration
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Agent"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this agent do?"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-model">Model</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-model"
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
              <Label htmlFor="edit-systemPrompt">System Prompt</Label>
              <Textarea
                id="edit-systemPrompt"
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
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={updateAgentMut.isPending || !name.trim()}>
              {updateAgentMut.isPending ? 'Updating...' : 'Update Agent'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>

      <ModelsHelperDialog
        control={modelsHelperDialog}
        onModelSelect={handleModelSelect}
      />
    </Dialog>
  );
}

