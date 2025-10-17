'use client';

import { useEffect } from 'react';
import { SidebarLeft, FloatingMobileMenuButton } from '@/components/sidebar/sidebar-left';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

interface DashboardLayoutContentProps {
  children: React.ReactNode;
}

export default function DashboardLayoutContent({
  children,
}: DashboardLayoutContentProps) {
  const router = useRouter();

  // Check authentication status
  useEffect(() => {
    // For now, we'll skip auth check since we don't have the auth context set up
    // In a real implementation, you would check authentication here
    // if (!isLoading && !user) {
    //   router.push('/auth');
    // }
  }, [router]);

  // Show loading state while checking auth
  // if (isLoading) {
  //   return (
  //     <div className="flex items-center justify-center min-h-screen">
  //       <Loader2 className="h-8 w-8 animate-spin text-primary" />
  //     </div>
  //   );
  // }

  // Don't render anything if not authenticated
  // if (!user) {
  //   return null;
  // }

  const mantenanceBanner: React.ReactNode | null = null;

  return (
    <SidebarProvider>
      <SidebarLeft />
      <SidebarInset>
        {mantenanceBanner}
        <div className="bg-background">{children}</div>
      </SidebarInset>

      {/* Floating mobile menu button */}
      <FloatingMobileMenuButton />
    </SidebarProvider>
  );
}
