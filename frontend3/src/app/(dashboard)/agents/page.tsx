'use client';

import { useState, useMemo } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useAgents } from '@/hooks/use-agents';
import { AgentCard } from '@/components/agents/agent-card';
import { CreateAgentDialog } from '@/components/agents/create-agent-dialog';

export default function AgentsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  
  const { data: agents, isLoading, refetch, error } = useAgents();

  const filteredAgents = useMemo(() => {
    if (!agents) return [];
    
    return agents.filter(agent =>
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [agents, searchQuery]);

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold">Agents</h1>
            <p className="text-muted-foreground mt-1">
              Manage your AI agents
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {error ? (
        <Card className="p-12 text-center border-destructive">
          <div className="mx-auto max-w-md">
            <h3 className="text-lg font-semibold mb-2 text-destructive">
              Error loading agents
            </h3>
            <p className="text-muted-foreground mb-4">
              {error instanceof Error ? error.message : 'An unexpected error occurred'}
            </p>
            <Button onClick={() => refetch()} variant="outline">
              Try Again
            </Button>
          </div>
        </Card>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAgents.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="mx-auto max-w-md">
            <h3 className="text-lg font-semibold mb-2">
              {searchQuery ? 'No agents found' : 'No agents yet'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Get started by creating your first agent'}
            </p>
            {!searchQuery && (
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Agent
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => (
            <AgentCard key={agent.agent_id} agent={agent} onUpdate={refetch} />
          ))}
        </div>
      )}

      <CreateAgentDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={refetch}
      />
    </div>
  );
}

