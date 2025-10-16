"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import HeaderTopbar from "@/components/dashboard/layout/header-topbar";
import { useTranslation } from "react-i18next";

export default function InstructorPage() {
    const { t } = useTranslation(["dashboard", "common"]);
    const breadcrumbs = [
        { label: t("sidebar.instructor"), href: "/dashboard/instructor" },
    ];
    return (
        <DashboardContent breadcrumbs={breadcrumbs}>
            <div className="flex flex-col gap-4">
                <HeaderTopbar
                    header={{
                        title: t("sidebar.instructor"),
                    }}
                />
            </div>
        </DashboardContent>
    );
}