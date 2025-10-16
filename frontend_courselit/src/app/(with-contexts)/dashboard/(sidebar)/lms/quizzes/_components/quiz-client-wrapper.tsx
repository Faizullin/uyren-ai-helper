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
import { QuizProvider, useQuizContext } from "./quiz-context";
import QuizQuestions from "./quiz-questions";
import QuizSettings from "./quiz-settings";
import QuizSubmissions from "./quiz-submissions";

interface QuizClientWrapperProps {
  initialMode: FormMode;
  initialQuizData?: any;
}

function QuizContent() {
  const { mode, quiz, updateMutation } = useQuizContext();

  const { toast } = useToast();
  const breadcrumbs = useMemo(
    () => [
      {
        label: "LMS",
        href: `/dashboard/lms`,
      },
      {
        label: "Quizzes",
        href: "/dashboard/lms/quizzes",
      },
      {
        label: mode === "create" ? "New Quiz" : "Edit Quiz",
        href: "#",
      },
    ],
    [mode],
  );

  const handleStatusChange = useCallback(
    async (newStatus: PublicationStatusEnum) => {
      if (!quiz?._id) return;

      try {
        await updateMutation.mutateAsync({
          id: quiz._id,
          data: { publicationStatus: newStatus },
        });
      } catch (error) {
        // Error handling is done in the mutation
      }
    },
    [quiz],
  );

  const pulicationStatusLabel = useMemo(() => {
    const data = {
      [PublicationStatusEnum.DRAFT]: "Draft",
      [PublicationStatusEnum.PUBLISHED]: "Published",
      [PublicationStatusEnum.ARCHIVED]: "Archived",
    }
    return data[quiz?.publicationStatus as PublicationStatusEnum] || "Draft";
  }, [quiz?.publicationStatus]);

  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-6">
        <HeaderTopbar
          backLink={true}
          header={{
            title: mode === "create" ? "New Quiz" : "Edit Quiz",
            subtitle:
              mode === "create"
                ? "Build a new quiz with questions and settings"
                : "Edit quiz settings and questions",
          }}
          rightAction={
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    disabled={
                      !quiz || updateMutation.isPending || mode === "create"
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
                    disabled={quiz?.publicationStatus === PublicationStatusEnum.DRAFT}
                  >
                    Draft
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleStatusChange(
                        PublicationStatusEnum.PUBLISHED,
                      )
                    }
                    disabled={quiz?.publicationStatus === PublicationStatusEnum.PUBLISHED}
                  >
                    Published
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      handleStatusChange(PublicationStatusEnum.ARCHIVED)
                    }
                    disabled={quiz?.publicationStatus === PublicationStatusEnum.ARCHIVED}
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
            <TabsTrigger value="settings">Quiz Settings</TabsTrigger>
            <TabsTrigger value="questions" disabled={mode === "create"}>
              Questions
              {/* ({questions.length}) */}
            </TabsTrigger>
            <TabsTrigger value="submissions" disabled={mode === "create"}>
              Submissions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            <QuizSettings />
          </TabsContent>

          <TabsContent value="questions" className="space-y-6">
            {mode === "edit" ? (
              <QuizQuestions />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Save the quiz first to add questions.
              </div>
            )}
          </TabsContent>

          <TabsContent value="submissions" className="space-y-6">
            {mode === "edit" ? (
              <QuizSubmissions />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Save the quiz first to view submissions.
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardContent>
  );
}

export default function QuizClientWrapper({
  initialMode,
  initialQuizData,
}: QuizClientWrapperProps) {
  return (
    <QuizProvider initialMode={initialMode} initialData={initialQuizData}>
      <QuizContent />
    </QuizProvider>
  );
}
