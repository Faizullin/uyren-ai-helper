'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plug, Plus, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function IntegrationsPage() {
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-6">
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          Connect external services and tools to your agents
        </p>
      </div>

      <Card className="p-12 text-center">
        <Plug className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Integrations Yet</h3>
        <p className="text-muted-foreground mb-4">
          Connect services like Google Drive, Slack, GitHub, and more
        </p>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Integration
        </Button>
      </Card>
    </div>
  );
}

