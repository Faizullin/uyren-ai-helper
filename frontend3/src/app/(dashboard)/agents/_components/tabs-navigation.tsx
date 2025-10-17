'use client';

import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TabsNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onCreateAgent: () => void;
}

export function TabsNavigation({ activeTab, onTabChange, onCreateAgent }: TabsNavigationProps) {
  const tabs = [
    { id: 'my-agents', label: 'My Agents' },
    { id: 'marketplace', label: 'Marketplace' },
  ];

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant="ghost"
            size="sm"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      <Button onClick={onCreateAgent} className="flex items-center gap-2">
        <Plus className="h-4 w-4" />
        Create Agent
      </Button>
    </div>
  );
}
