"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import HeaderTopbar from "@/components/dashboard/layout/header-topbar";
import { useTranslation } from "react-i18next";

export default function Page() {
    const { t } = useTranslation(["dashboard", "common"]);

    const breadcrumbs = [{ label: t("common:dashboard.student.title"), href: "#" }];

    return (
        <DashboardContent breadcrumbs={breadcrumbs}>
            <div className="flex flex-col gap-4">
                <HeaderTopbar
                    header={{
                        title: t("common:dashboard.student.title"),
                    }}
                />
            </div>
        </DashboardContent>
    )
}