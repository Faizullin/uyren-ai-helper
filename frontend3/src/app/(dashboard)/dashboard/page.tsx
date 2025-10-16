'use client';

import { Card } from '@/components/ui/card';
import { Bot, MessageSquare, Loader2 } from 'lucide-react';
import { useAgents } from '@/hooks/use-agents';
import { useThreads } from '@/hooks/use-threads';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DashboardPage() {
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const { data: threads, isLoading: threadsLoading } = useThreads();

  const stats = [
    {
      title: 'Total Agents',
      value: agents?.length || 0,
      icon: Bot,
      href: '/agents',
      loading: agentsLoading,
    },
    {
      title: 'Total Threads',
      value: threads?.length || 0,
      icon: MessageSquare,
      href: '/threads',
      loading: threadsLoading,
    },
  ];

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome to your AI Helper dashboard
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link key={stat.title} href={stat.href}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      {stat.title}
                    </p>
                    {stat.loading ? (
                      <Loader2 className="h-6 w-6 animate-spin mt-2 text-muted-foreground" />
                    ) : (
                      <p className="text-3xl font-bold mt-2">{stat.value}</p>
                    )}
                  </div>
                  <Icon className="h-8 w-8 text-muted-foreground" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {threadsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : threads && threads.length > 0 ? (
              threads.slice(0, 5).map((thread) => (
                <div
                  key={thread.thread_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent/50"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {thread.metadata?.title || `Thread ${thread.thread_id.slice(0, 8)}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(thread.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No recent activity
              </p>
            )}
          </div>
          {threads && threads.length > 5 && (
            <Link href="/threads">
              <Button variant="ghost" className="w-full mt-4">
                View all threads
              </Button>
            </Link>
          )}
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/agents">
              <Button className="w-full justify-start" variant="outline">
                <Bot className="mr-2 h-4 w-4" />
                Manage Agents
              </Button>
            </Link>
            <Link href="/threads">
              <Button className="w-full justify-start" variant="outline">
                <MessageSquare className="mr-2 h-4 w-4" />
                View Threads
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

