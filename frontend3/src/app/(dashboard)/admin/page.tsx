'use client';

import { Card } from '@/components/ui/card';
import { Shield, Users, Database, Settings } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function AdminPage() {
  const adminSections = [
    {
      title: 'User Management',
      description: 'Manage user accounts and permissions',
      icon: Users,
      href: '/dashboard/admin/users',
    },
    {
      title: 'System Settings',
      description: 'Configure system-wide settings',
      icon: Settings,
      href: '/dashboard/admin/system',
    },
    {
      title: 'Database',
      description: 'View database statistics and health',
      icon: Database,
      href: '/dashboard/admin/database',
    },
  ];

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>
        <p className="text-muted-foreground">
          System administration and management
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {adminSections.map((section) => {
          const Icon = section.icon;
          return (
            <Link key={section.href} href={section.href}>
              <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer h-full">
                <Icon className="h-8 w-8 text-primary mb-4" />
                <h3 className="text-lg font-semibold mb-2">{section.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {section.description}
                </p>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card className="mt-8 p-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-1">
              Admin Access Required
            </h3>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              You need administrator privileges to access admin features. 
              Contact your system administrator if you need access.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

