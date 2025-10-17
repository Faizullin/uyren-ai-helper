'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Bot, MessageSquare, Loader2, TrendingUp } from 'lucide-react';
import { useAgents } from '@/hooks/use-agents';
import { useThreads } from '@/hooks/use-threads';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface StatsOverviewProps {
  className?: string;
}

export function StatsOverview({ className }: StatsOverviewProps) {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: threads, isLoading: threadsLoading } = useThreads();

  const stats = [
    {
      title: 'Agents',
      value: agents?.length || 0,
      icon: Bot,
      href: '/agents',
      loading: agentsLoading,
      color: 'text-blue-500',
    },
    {
      title: 'Threads',
      value: threads?.length || 0,
      icon: MessageSquare,
      href: '/threads',
      loading: threadsLoading,
      color: 'text-green-500',
    },
    {
      title: 'Active',
      value: threads?.filter(t => new Date(t.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length || 0,
      icon: TrendingUp,
      href: '/threads',
      loading: threadsLoading,
      color: 'text-orange-500',
    },
  ];

  return (
    <div className={cn("w-full max-w-4xl mx-auto", className)}>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="p-4 hover:shadow-md transition-all duration-200 cursor-pointer border-l-4 border-l-transparent hover:border-l-primary/20">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {stat.title}
                    </p>
                    {stat.loading ? (
                      <Loader2 className="h-5 w-5 animate-spin mt-1 text-muted-foreground" />
                    ) : (
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    )}
                  </div>
                  <Icon className={cn("h-5 w-5", stat.color)} />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
