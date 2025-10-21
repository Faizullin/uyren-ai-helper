'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';

export function KnowledgeBaseHeader() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">
            <span className="text-primary">Knowledge Base</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Organize documents and files for AI agents to search and reference
          </p>
        </div>
      </div>
    </div>
  );
}

