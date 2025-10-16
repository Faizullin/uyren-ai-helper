"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import SchoolsManagement from "./_components/schools-management";


export default function SchoolsPage() {
  const breadcrumbs = [
    { label: "Settings", href: "/dashboard/settings" },
    { label: "Schools", href: "#" },
  ];
  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <SchoolsManagement />
    </DashboardContent>
  );
}
