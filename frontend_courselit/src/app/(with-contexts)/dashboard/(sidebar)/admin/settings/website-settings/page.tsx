"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import { useTranslation } from "react-i18next";
import WebsiteSettings from "./_components/website-settings";

export default function WebsiteSettingsPage() {
  const { t } = useTranslation(["dashboard", "common"]);
  const breadcrumbs = [
    { label: t("sidebar.settings"), href: "/dashboard/settings" },
    { label: t("sidebar.website_settings"), href: "/dashboard/settings/website-settings" },
  ];
  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <WebsiteSettings />
    </DashboardContent>
  );
}
