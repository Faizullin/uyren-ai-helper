"use client";

import { useProfile } from "@/components/contexts/profile-context";
import { NotificationsViewer } from "@/components/notifications-viewer";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Separator } from "@workspace/ui/components/separator";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";
import { checkPermission } from "@workspace/utils";
import Link from "next/link";
import { Fragment, ReactNode } from "react";
import LoadingScreen from "./loading-screen";
import PermissionError from "./permission-error";

export default function DashboardContent({
  breadcrumbs,
  children,
  permissions = [],
}: {
  breadcrumbs: {
    label: string;
    href: string;
  }[];
  children: ReactNode;
  permissions?: Array<string>;
}) {
  const { profile } = useProfile();

  if (!profile?.id) {
    return <LoadingScreen />;
  }

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          {breadcrumbs.length > 0 && (
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((breadcrumb, index) => (
                  <Fragment key={index}>
                    {index < breadcrumbs.length - 1 && (
                      <>
                        <BreadcrumbItem className="hidden md:block">
                          <BreadcrumbLink asChild>
                            <Link href={breadcrumb.href}>
                              {breadcrumb.label}
                            </Link>
                          </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator className="hidden md:block" />
                      </>
                    )}
                    {index === breadcrumbs.length - 1 && (
                      <BreadcrumbItem>
                        <BreadcrumbPage>{breadcrumb.label}</BreadcrumbPage>
                      </BreadcrumbItem>
                    )}
                  </Fragment>
                ))}
                {/* <BreadcrumbItem className="hidden md:block">
                                    <BreadcrumbLink href="#">
                                        Building Your Application
                                    </BreadcrumbLink>
                                </BreadcrumbItem>
                                <BreadcrumbSeparator className="hidden md:block" />
                                <BreadcrumbItem>
                                    <BreadcrumbPage>
                                        Data Fetching
                                    </BreadcrumbPage>
                                </BreadcrumbItem> */}
              </BreadcrumbList>
            </Breadcrumb>
          )}
        </div>
        <div className="ml-auto px-3">
          <NotificationsViewer />
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {permissions.length > 0 ? (
          checkPermission(profile?.permissions || [], permissions) ? (
            children
          ) : (
            <PermissionError missingPermissions={permissions} />
          )
        ) : (
          children
        )}
      </div>
    </>
  );
}
