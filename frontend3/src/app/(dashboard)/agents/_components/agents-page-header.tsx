'use client';

import { Bot, Sparkles } from 'lucide-react';

export function AgentsPageHeader() {
  return (
    <div className="text-center space-y-4">
      <div className="flex items-center justify-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div className="text-left">
          <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
          <p className="text-muted-foreground">
            Create, manage, and deploy intelligent AI agents
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        <span>Build powerful AI workflows with custom agents</span>
      </div>
    </div>
  );
}
