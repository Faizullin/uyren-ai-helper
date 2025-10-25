import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';

interface ThreadLayoutProps {
  children: React.ReactNode;
  threadId: string;
  projectName: string;
  projectId: string;
  debugMode?: boolean;
  compact?: boolean;
}

export function ThreadLayout({
  children,
  threadId,
  projectName,
  projectId,
  debugMode = false,
  compact = false
}: ThreadLayoutProps) {
  const isMobile = useIsMobile();

  // Compact mode for embedded use
  if (compact) {
    return (
      <div className="relative h-full">
        {debugMode && (
          <div className="absolute top-4 right-4 bg-amber-500 text-black text-xs px-2 py-1 rounded-md shadow-md z-50">
            Debug Mode
          </div>
        )}
        <div className="flex flex-col h-full overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  // Full layout mode
  return (
    <div className="flex h-screen">
      {debugMode && (
        <div className="fixed top-16 right-4 bg-amber-500 text-black text-xs px-2 py-1 rounded-md shadow-md z-50">
          Debug Mode
        </div>
      )}

      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Simple header */}
        <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center space-x-3">
              <div className="flex flex-col">
                <h1 className="text-lg font-semibold">{projectName}</h1>
                <p className="text-sm text-muted-foreground">Thread: {threadId}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {debugMode && (
                <div className="text-xs text-muted-foreground">
                  Debug Mode
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}