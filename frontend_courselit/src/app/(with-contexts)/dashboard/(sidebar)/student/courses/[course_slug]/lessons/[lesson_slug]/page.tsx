"use client";


import DashboardContent from "@/components/dashboard/dashboard-content";
import HeaderTopbar from "@/components/dashboard/layout/header-topbar";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";

export default function Page() {
    const { t } = useTranslation(["dashboard", "common"]);

    const breadcrumbs = [{ label: t("common:dashboard.student.courses.title"), href: "#" }];
    const { slug } = useParams();

    return (
        <DashboardContent breadcrumbs={breadcrumbs}>
            <HeaderTopbar
                header={{
                    title: t("common:dashboard.student.lessons.title"),
                }}
            />
        </DashboardContent>
    )
}