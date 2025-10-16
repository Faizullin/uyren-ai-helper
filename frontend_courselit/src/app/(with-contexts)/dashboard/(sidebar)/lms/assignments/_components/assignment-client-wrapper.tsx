"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import HeaderTopbar from "@/components/dashboard/layout/header-topbar";
import { FormMode } from "@/components/dashboard/layout/types";
import { PublicationStatusEnum } from "@workspace/common-logic/lib/publication_status";
import { useToast } from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs";
import { ChevronDown } from "lucide-react";
import { useCallback, useMemo } from "react";
import { AssignmentProvider, useAssignmentContext } from "./assignment-context";
import AssignmentGrading from "./assignment-grading";
import AssignmentSettings from "./assignment-settings";
import AssignmentSubmissions from "./assignment-submissions";

interface AssignmentClientWrapperProps {
  initialMode: FormMode;
  initialAssignmentData?: any;
}

function AssignmentContent() {
  const { mode, assignment, updateMutation } = useAssignmentContext();

  const { toast } = useToast();
  const breadcrumbs = useMemo(
    () => [
      {
        label: "LMS",
        href: `/dashboard/lms`,
      },
      {
        label: "Assignments",
        href: "/dashboard/lms/assignments",
      },
      {
        label: mode === "create" ? "New Assignment" : "Edit Assignment",
        href: "#",
      },
    ],
    [mode],
  );

  const handleStatusChange = useCallback(
    async (newStatus: PublicationStatusEnum) => {
      if (!assignment?._id) return;

      try {
        await updateMutation.mutateAsync({
          id: assignment._id,
          data: { publicationStatus: newStatus },
        });
      } catch (error) {
      }
    },
    [assignment?._id, updateMutation],
  );

  const pulicationStatusLabel = useMemo(() => {
    const data = {
      [PublicationStatusEnum.DRAFT]: "Draft",
      [PublicationStatusEnum.PUBLISHED]: "Published",
      [PublicationStatusEnum.ARCHIVED]: "Archived",
    }
    return data[assignment?.publicationStatus as PublicationStatusEnum] || "Draft";
  }, [assignment?.publicationStatus]);

  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-6">
        <HeaderTopbar
          backLink={true}
          header={{
            title: mode === "create" ? "New Assignment" : "Edit Assignment",
            subtitle:
              mode === "create"
                ? "Create a new assignment with detailed configuration"
                : "Edit assignment settings and manage submissions",
          }}
          rightAction={
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={
                      !assignment ||
                      updateMutation.isPending ||
                      mode === "create"
                    }
                    className="flex items-center gap-2"
                  >
                    {pulicationStatusLabel}
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() =>
                      handleStatusChange(PublicationStatusEnum.DRAFT)
                    }
                    disabled={assignment?.publicationStatus === PublicationStatusEnum.DRAFT}
                  >
                    Draft
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleStatusChange(
                        PublicationStatusEnum.PUBLISHED,
                      )
                    }
                    disabled={assignment?.publicationStatus === PublicationStatusEnum.PUBLISHED}
                  >
                    Published
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleStatusChange(PublicationStatusEnum.ARCHIVED)
                    }
                    disabled={assignment?.publicationStatus === PublicationStatusEnum.ARCHIVED}
                  >
                    Archived
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        />

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList>
            <TabsTrigger value="settings">Basic Information</TabsTrigger>
            <TabsTrigger value="submissions" disabled={mode === "create"}>
              Submissions
            </TabsTrigger>
            <TabsTrigger value="grading" disabled={mode === "create"}>
              Grading
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <AssignmentSettings />
          </TabsContent>

          <TabsContent value="submissions" className="space-y-6">
            {mode === "edit" ? (
              <AssignmentSubmissions />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Save the assignment first to manage submissions.
              </div>
            )}
          </TabsContent>

          <TabsContent value="grading" className="space-y-6">
            {mode === "edit" ? (
              <AssignmentGrading />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Save the assignment first to configure grading.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardContent>
  );
}

export default function AssignmentClientWrapper({
  initialMode,
  initialAssignmentData,
}: AssignmentClientWrapperProps) {
  return (
    <AssignmentProvider
      initialMode={initialMode}
      initialData={initialAssignmentData}
    >
      <AssignmentContent />
    </AssignmentProvider>
  );
}
