'use client';

import { useState, useMemo } from 'react';
import { Search, Plus, Loader2, Grid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { AgentCard } from '@/components/agents/agent-card';
import { cn } from '@/lib/utils';

type ViewMode = 'grid' | 'list';

interface MyAgentsTabProps {
  agentsSearchQuery: string;
  setAgentsSearchQuery: (query: string) => void;
  agentsLoading: boolean;
  agents: any[];
  agentsPagination?: any;
  viewMode: ViewMode;
  onCreateAgent: () => void;
  onEditAgent: (agentId: string) => void;
  onDeleteAgent: (agentId: string) => void;
  onToggleDefault: (agentId: string, currentDefault: boolean) => void;
  onClearFilters: () => void;
  isDeletingAgent: boolean;
  setAgentsPage: (page: number) => void;
  agentsPageSize: number;
  onAgentsPageSizeChange: (size: number) => void;
  myTemplates: any[];
  templatesLoading: boolean;
  templatesError: any;
  templatesActioningId: string | null;
  templatesPagination?: any;
  templatesPage: number;
  setTemplatesPage: (page: number) => void;
  templatesPageSize: number;
  onTemplatesPageSizeChange: (size: number) => void;
  templatesSearchQuery: string;
  setTemplatesSearchQuery: (query: string) => void;
  onPublish: (template: any) => void;
  onUnpublish: (templateId: string, templateName: string) => void;
  getTemplateStyling: (template: any) => any;
  onPublishAgent: (agent: any) => void;
  publishingAgentId: string | null;
}

export function MyAgentsTab({
  agentsSearchQuery,
  setAgentsSearchQuery,
  agentsLoading,
  agents,
  viewMode,
  onCreateAgent,
  onEditAgent,
  onDeleteAgent,
  onToggleDefault,
  onClearFilters,
  isDeletingAgent,
}: MyAgentsTabProps) {
  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(viewMode);

  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    
    return agents.filter((agent: any) =>
      agent.name.toLowerCase().includes(agentsSearchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(agentsSearchQuery.toLowerCase())
    );
  }, [agents, agentsSearchQuery]);

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={agentsSearchQuery}
            onChange={(e) => setAgentsSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentViewMode('grid')}
              className={cn(
                "h-8 w-8 p-0",
                currentViewMode === 'grid' && "bg-background shadow-sm"
              )}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentViewMode('list')}
              className={cn(
                "h-8 w-8 p-0",
                currentViewMode === 'list' && "bg-background shadow-sm"
              )}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={onCreateAgent} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Agent
          </Button>
        </div>
      </div>

      {/* Agents List */}
      {agentsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAgents.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto max-w-md">
            <h3 className="text-lg font-semibold mb-2">
              {agentsSearchQuery ? 'No agents found' : 'No agents yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {agentsSearchQuery
                ? 'Try adjusting your search query'
                : 'Get started by creating your first agent'}
            </p>
            {!agentsSearchQuery && (
              <Button onClick={onCreateAgent}>
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className={cn(
          "grid gap-4",
          currentViewMode === 'grid' 
            ? "sm:grid-cols-2 lg:grid-cols-3" 
            : "grid-cols-1"
        )}>
          {filteredAgents.map((agent: any) => (
            <AgentCard 
              key={agent.agent_id} 
              agent={agent} 
              onUpdate={() => {}} 
              onEdit={onEditAgent}
              onDelete={onDeleteAgent}
              onToggleDefault={onToggleDefault}
            />
          ))}
        </div>
      )}
    </div>
  );
}
