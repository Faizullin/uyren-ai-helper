'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Settings,
  Wrench,
  BookOpen,
  Zap,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface AgentConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  initialTab?: 'instructions' | 'tools' | 'integrations' | 'knowledge' | 'triggers';
  onAgentChange?: (agentId: string) => void;
}

export function AgentConfigurationDialog({
  open,
  onOpenChange,
  agentId,
  initialTab = 'instructions',
  onAgentChange,
}: AgentConfigurationDialogProps) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isLoading, setIsLoading] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const [agentInstructions, setAgentInstructions] = useState('');

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // TODO: Implement agent update logic
      toast.success('Agent configuration saved');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to save agent configuration');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Agent Configuration
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="instructions" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Instructions
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Tools
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Knowledge
            </TabsTrigger>
            <TabsTrigger value="triggers" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Triggers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="instructions" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Agent Name</Label>
              <Input
                id="agent-name"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Enter agent name"
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-instructions">Instructions</Label>
              <Textarea
                id="agent-instructions"
                value={agentInstructions}
                onChange={(e) => setAgentInstructions(e.target.value)}
                placeholder="Enter detailed instructions for the agent"
                rows={8}
              />
            </div>
          </TabsContent>

          <TabsContent value="tools" className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Tools Configuration</h3>
              <p>Tool configuration will be available here</p>
            </div>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Integrations</h3>
              <p>Integration configuration will be available here</p>
            </div>
          </TabsContent>

          <TabsContent value="knowledge" className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Knowledge Base</h3>
              <p>Knowledge base configuration will be available here</p>
            </div>
          </TabsContent>

          <TabsContent value="triggers" className="space-y-4">
            <div className="text-center py-8 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-semibold mb-2">Triggers</h3>
              <p>Trigger configuration will be available here</p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
