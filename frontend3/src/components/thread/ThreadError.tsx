import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ThreadErrorProps {
  error: Error;
}

export function ThreadError({ error }: ThreadErrorProps) {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <Alert className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <h3 className="font-semibold mb-2">Error loading thread</h3>
          <p className="text-sm text-muted-foreground">
            {error.message || 'An unexpected error occurred'}
          </p>
        </AlertDescription>
      </Alert>
    </div>
  );
}
