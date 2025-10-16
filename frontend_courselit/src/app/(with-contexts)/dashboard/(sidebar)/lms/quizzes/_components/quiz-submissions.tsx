"use client";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import { GeneralRouterOutputs } from "@/server/api/types";
import { trpc } from "@/utils/trpc";
import { ColumnDef } from "@tanstack/react-table";
import {
  DeleteConfirmNiceDialog,
  NiceModal,
  useToast
} from "@workspace/components-library";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Calendar,
  Clock,
  Eye,
  FileQuestion,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuizContext } from "./quiz-context";

type QuizAttemptType =
  GeneralRouterOutputs["lmsModule"]["quizModule"]["quizAttempt"]["list"]["items"][number];

export default function QuizSubmissions() {
  const { quiz } = useQuizContext();
  const [parsedData, setParsedData] = useState<QuizAttemptType[]>([]);
  const [parsedPagination, setParsedPagination] = useState({ pageCount: 0 });

  const { toast } = useToast();
  const trpcUtils = trpc.useUtils();

  const deleteSubmissionMutation =
    trpc.lmsModule.quizModule.quizAttempt.delete.useMutation({
      onSuccess: () => {
        trpcUtils.lmsModule.quizModule.quizAttempt.list.invalidate();
        toast({
          title: "Submission Deleted",
          description: "Student submission has been deleted successfully",
        });
      },
    });

  const regradeAttemptMutation =
    trpc.lmsModule.quizModule.quizAttempt.regrade.useMutation({
      onSuccess: () => {
        trpcUtils.lmsModule.quizModule.quizAttempt.list.invalidate();
        toast({
          title: "Regrade Complete",
          description: "Quiz attempt has been regraded successfully",
        });
      },
      onError: (error) => {
        toast({
          title: "Regrade Failed",
          description: error.message,
          variant: "destructive",
        });
      },
    });

  const handleViewResults = useCallback(
    (submission: QuizAttemptType) => {
      // Open existing results page in new tab
      const resultsUrl = `/quiz/${quiz?._id}/attempts/${submission._id}/results`;
      window.open(resultsUrl, "_blank");
    },
    [quiz?._id],
  );

  const handleRegradeAttempt = useCallback(
    (submission: QuizAttemptType) => {
      regradeAttemptMutation.mutate({
        id: submission._id,
      });
    },
    [regradeAttemptMutation],
  );

  const handleDeleteSubmission = useCallback(
    (submission: QuizAttemptType) => {
      NiceModal.show(DeleteConfirmNiceDialog, {
        title: "Delete Submission",
        message: `Are you sure you want to delete the submission for "${submission.user?.fullName || submission.user?.email || "Unknown Student"}"? This action cannot be undone.`,
        data: submission,
      }).then((result) => {
        if (result.reason === "confirm") {
          const obj = result.data as QuizAttemptType;
          deleteSubmissionMutation.mutate({
            id: obj._id,
          });
        }
      });
    },
    [toast, deleteSubmissionMutation],
  );

  const columns: ColumnDef<QuizAttemptType>[] = useMemo(() => {
    return [
      {
        accessorKey: "userId",
        header: "Student",
        cell: ({ row }) => {
          const attempt = row.original;
          return (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded flex items-center justify-center">
                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-medium">
                  {attempt.user?.fullName ||
                    attempt.user?.email ||
                    attempt.userId ||
                    "Unknown Student"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {attempt.user?.email || "No email"}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "score",
        header: "Score",
        cell: ({ row }) => {
          const attempt = row.original;
          const totalPoints = quiz?.totalPoints || 100;
          return (
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {attempt.score || 0}/{totalPoints}
              </span>
              <Badge
                variant={
                  attempt.percentageScore && attempt.percentageScore >= 70
                    ? "default"
                    : "secondary"
                }
              >
                {attempt.percentageScore
                  ? `${attempt.percentageScore}%`
                  : "N/A"}
              </Badge>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const status = row.original.status;
          const getStatusVariant = (status: string) => {
            switch (status) {
              case "completed":
                return "default";
              case "graded":
                return "default";
              case "in_progress":
                return "secondary";
              case "abandoned":
                return "destructive";
              default:
                return "secondary";
            }
          };

          const getStatusLabel = (status: string) => {
            switch (status) {
              case "completed":
                return "Completed";
              case "graded":
                return "Graded";
              case "in_progress":
                return "In Progress";
              case "abandoned":
                return "Abandoned";
              default:
                return "Unknown";
            }
          };

          return (
            <Badge variant={getStatusVariant(status)}>
              {getStatusLabel(status)}
            </Badge>
          );
        },
        meta: {
          label: "Status",
          variant: "select",
          options: [
            { label: "All", value: "" },
            { label: "Completed", value: "completed" },
            { label: "Graded", value: "graded" },
            { label: "In Progress", value: "in_progress" },
            { label: "Abandoned", value: "abandoned" },
          ],
        },
      },
      {
        accessorKey: "timeSpent",
        header: "Time Taken",
        cell: ({ row }) => {
          const timeSpent = row.original.timeSpent;
          return (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              {timeSpent
                ? `${Math.floor(timeSpent / 60)}m ${timeSpent % 60}s`
                : "N/A"}
            </div>
          );
        },
      },
      {
        accessorKey: "completedAt",
        header: "Submitted",
        cell: ({ row }) => {
          const attempt = row.original;
          const date = attempt.completedAt;
          return (
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {date ? new Date(date).toLocaleDateString() : "Not submitted"}
            </div>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const attempt = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleViewResults(attempt)}>
                  <Eye className="h-4 w-4 mr-2" />
                  View Results
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleRegradeAttempt(attempt)}
                  disabled={regradeAttemptMutation.isPending}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regrade
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleDeleteSubmission(attempt)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];
  }, [
    quiz?.totalPoints,
    handleViewResults,
    handleRegradeAttempt,
    handleDeleteSubmission,
    regradeAttemptMutation.isPending,
  ]);

  const { table } = useDataTable({
    columns,
    data: parsedData,
    pageCount: parsedPagination.pageCount,
    enableGlobalFilter: true,
    initialState: {
      sorting: [{ id: "completedAt", desc: true }],
    },
  });

  const tableState = table.getState();
  const queryParams = useMemo(() => {
    const parsed: any = {
      pagination: {
        skip: tableState.pagination.pageIndex * tableState.pagination.pageSize,
        take: tableState.pagination.pageSize,
      },
      filter: {
        quizId: quiz?._id,
        status: Array.isArray(
          tableState.columnFilters.find((filter) => filter.id === "status")
            ?.value,
        )
          ? ((
            tableState.columnFilters.find((filter) => filter.id === "status")
              ?.value as string[]
          )[0] as "completed" | "graded" | "in_progress" | "abandoned")
          : undefined,
      },
    };
    if (tableState.sorting[0]) {
      parsed.orderBy = {
        field: tableState.sorting[0].id as any,
        direction: tableState.sorting[0].desc ? "desc" : "asc",
      };
    }
    if (tableState.globalFilter) {
      parsed.search = {
        q: tableState.globalFilter,
      };
    }
    return parsed;
  }, [
    tableState.sorting,
    tableState.pagination,
    tableState.columnFilters,
    tableState.globalFilter,
    quiz?._id,
  ]);

  const loadSubmissionsQuery =
    trpc.lmsModule.quizModule.quizAttempt.list.useQuery(queryParams, {
      enabled: !!quiz?._id,
    });

  useEffect(() => {
    if (!loadSubmissionsQuery.data) return;
    const parsed = loadSubmissionsQuery.data.items || [];
    setParsedData(parsed);
    setParsedPagination({
      pageCount: Math.ceil(
        (loadSubmissionsQuery.data.total || 0) /
        (loadSubmissionsQuery.data.meta?.take || 20),
      ),
    });
  }, [loadSubmissionsQuery.data]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <FileQuestion className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Quiz Submissions</span>
        </div>
        {parsedData.length > 0 && (
          <Badge variant="outline">{parsedData.length} Submissions</Badge>
        )}
      </div>

      <Card>
        <CardContent>
          <div className="flex flex-col gap-2">
            <DataTable table={table}>
              <DataTableToolbar table={table} />
            </DataTable>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
