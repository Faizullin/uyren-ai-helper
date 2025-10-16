"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import { CreateButton } from "@/components/dashboard/layout/create-button";
import HeaderTopbar from "@/components/dashboard/layout/header-topbar";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { useDialogControl } from "@workspace/components-library";
import { useTranslation } from "react-i18next";
import { CohortCreateDialog } from "./_components/cohort-create-dialog";

export default function Page() {
    const { t } = useTranslation(["dashboard", "common"]);

    const createCohortDialogControl = useDialogControl();

    const breadcrumbs = [{ label: t("common:dashboard.cohorts.title"), href: "#" }];

    return (
        <DashboardContent
            breadcrumbs={breadcrumbs}
            permissions={[UIConstants.permissions.manageAnyCourse, UIConstants.permissions.manageCourse]}
        >
            <div className="flex flex-col gap-4">
                <HeaderTopbar
                    header={{
                        title: t("lms.modules.cohorts.title"),
                        subtitle: t("lms.modules.cohorts.description"),
                    }}
                    rightAction={
                        <CreateButton
                            onClick={() => createCohortDialogControl.show()}
                            text="Add Cohort"
                        />
                    }
                />
                <CohortCreateDialog control={createCohortDialogControl} />
            </div>
        </DashboardContent>
    );
}