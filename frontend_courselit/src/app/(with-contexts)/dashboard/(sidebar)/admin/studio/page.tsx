"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Database, Server } from "lucide-react";
import Link from "next/link";

export default function Page() {
  return (
    <DashboardContent breadcrumbs={[{ label: "Studio", href: "#" }]}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Studio</h1>
          <p className="text-muted-foreground">Manage your application data and perform migrations</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Main Database
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mt-6">
                <Link href="/dashboard/studio/db">
                  <Button className="w-full">
                    Open Database Manager
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5 text-secondary" />
                Redis Cache
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mt-6">
                <Link href="/dashboard/studio/redis">
                  <Button variant="secondary" className="w-full">
                    Open Redis Manager
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-4 bg-muted/50 rounded-lg">
          <h3 className="font-medium mb-2">Studio Overview</h3>
          <p className="text-sm text-muted-foreground">
            The Studio provides administrative tools for managing your application's data and performing
            system operations. Use the Main Database tool for everyday data management and the Redis Cache
            tool for monitoring and managing cached data and performance.
          </p>
        </div>
      </div>
    </DashboardContent>
  );
}
