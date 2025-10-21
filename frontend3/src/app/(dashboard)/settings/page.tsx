'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Key, Shield } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Account Settings */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Account</h2>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="your@email.com" disabled />
              <p className="text-xs text-muted-foreground">
                Your email is managed through authentication
              </p>
            </div>
          </div>
        </Card>

        {/* API Keys */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">API Keys</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Manage your API keys for programmatic access
          </p>
          <Link href="/settings/api-keys">
            <Button variant="outline">
              Manage API Keys
            </Button>
          </Link>
        </Card>

        {/* Integrations */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">Integrations</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Connect external services and tools
          </p>
          <Link href="/settings/integrations">
            <Button variant="outline">
              Manage Integrations
            </Button>
          </Link>
        </Card>
      </div>
    </div>
  );
}

