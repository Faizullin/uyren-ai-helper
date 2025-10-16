"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import { CreateButton } from "@/components/dashboard/layout/create-button";
import HeaderTopbar from "@/components/dashboard/layout/header-topbar";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { useTranslation } from "react-i18next";

export default function Page() {
    const { t } = useTranslation(["dashboard", "common"]);

    const breadcrumbs = [{ label: t("common:dashboard.schedule.title"), href: "#" }];

    return (
        <DashboardContent breadcrumbs={breadcrumbs}
            permissions={[UIConstants.permissions.manageAnyCourse, UIConstants.permissions.manageCourse]}
        >
            <HeaderTopbar
                header={{
                    title: t("common:dashboard.schedule.title"),
                    subtitle: t("common:dashboard.schedule.description"),
                }}
                rightAction={<CreateButton text={t("common:dashboard.schedule.create")} />}
            />
        </DashboardContent>
    )
}