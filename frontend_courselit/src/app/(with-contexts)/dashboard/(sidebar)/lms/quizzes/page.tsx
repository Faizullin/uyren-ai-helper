"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import { CreateButton } from "@/components/dashboard/layout/create-button";
import HeaderTopbar from "@/components/dashboard/layout/header-topbar";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import { GeneralRouterOutputs } from "@/server/api/types";
import { trpc } from "@/utils/trpc";
import { type ColumnDef } from "@tanstack/react-table";
import { PublicationStatusEnum } from "@workspace/common-logic/lib/publication_status";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import { useDebounce } from "@workspace/ui/hooks/use-debounce";
import { Archive, Edit, FileQuestion, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const breadcrumbs = [
  { label: "LMS", href: "#" },
  { label: "Quizzes", href: "#" },
];

type ItemType =
  GeneralRouterOutputs["lmsModule"]["quizModule"]["quiz"]["list"]["items"][number];
type QueryParams = Parameters<
  typeof trpc.lmsModule.quizModule.quiz.list.useQuery
>[0];

export default function Page() {
  const { t } = useTranslation("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [parsedData, setParsedData] = useState<Array<ItemType>>([]);
  const [parsedPageination, setParsedPagination] = useState({
    pageCount: 1,
  });
  const archiveMutation = trpc.lmsModule.quizModule.quiz.archive.useMutation({
    onSuccess: () => {
      // Refetch the data to update the list
      loadListQuery.refetch();
    },
  });
  const handleArchive = useCallback(
    (quiz: ItemType) => {
      if (confirm("Are you sure you want to archive this quiz?")) {
        archiveMutation.mutate({
          id: quiz._id,
        });
      }
    },
    [archiveMutation],
  );
  const columns: ColumnDef<ItemType>[] = useMemo(() => {
    return [
      {
        accessorKey: "title",
        header: t("table.title"),
        cell: ({ row }) => {
          const quiz = row.original;
          return (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded flex items-center justify-center">
                <FileQuestion className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="font-medium">{quiz.title}</div>
                <div className="text-sm text-muted-foreground">
                  {quiz.description}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "courseId",
        header: t("table.course"),
        cell: ({ row }) => {
          const quiz = row.original;
          const course = (quiz as any).course;
          return (
            <Badge variant="outline">
              {course?.title || quiz.courseId || t("table.no_course")}
            </Badge>
          );
        },
      },
      {
        accessorKey: "ownerId",
        header: t("table.owner"),
        cell: ({ row }) => {
          const quiz = row.original;
          const owner = (quiz as any).owner;
          return (
            <div className="text-sm text-muted-foreground">
              {owner?.name || owner?.email || quiz.ownerId || t("table.unknown")}
            </div>
          );
        },
      },
      {
        accessorKey: "questionIds",
        header: t("table.questions"),
        cell: ({ row }) => {
          const questionIds = row.getValue("questionIds") as string[];
          return (
            <div className="flex items-center gap-1">
              <FileQuestion className="h-3 w-3 text-muted-foreground" />
              {questionIds?.length || 0}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("table.status"),
        cell: ({ row }) => {
          const status = row.original.publicationStatus;
          const getStatusVariant = (status: string) => {
            switch (status) {
              case PublicationStatusEnum.PUBLISHED:
                return "default";
              case PublicationStatusEnum.DRAFT:
                return "secondary";
              case PublicationStatusEnum.ARCHIVED:
                return "destructive";
              default:
                return "secondary";
            }
          };

          const getStatusLabel = (status: string) => {
            switch (status) {
              case PublicationStatusEnum.PUBLISHED:
                return t("table.published");
              case PublicationStatusEnum.DRAFT:
                return t("table.draft");
              case PublicationStatusEnum.ARCHIVED:
                return t("table.archived");
              default:
                return t("table.unknown");
            }
          };

          return (
            <Badge variant={getStatusVariant(status)}>
              {getStatusLabel(status)}
            </Badge>
          );
        },
        meta: {
          label: t("table.status"),
          variant: "select",
          options: [
            { label: t("table.published"), value: PublicationStatusEnum.PUBLISHED },
            { label: t("table.draft"), value: PublicationStatusEnum.DRAFT },
            { label: t("table.archived"), value: PublicationStatusEnum.ARCHIVED },
          ],
        },
        enableColumnFilter: true,
      },
      {
        accessorKey: "createdAt",
        header: t("table.created"),
        cell: ({ row }) => {
          const date = row.getValue("createdAt") as string;
          return (
            <div className="text-sm text-muted-foreground">
              {new Date(date).toLocaleDateString()}
            </div>
          );
        },
        meta: {
          label: t("table.created"),
          variant: "date",
        },
      },
      {
        id: "actions",
        header: t("table.actions"),
        cell: ({ row }) => {
          const quiz = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/lms/quizzes/${quiz._id}`}>
                    <Edit className="h-4 w-4 mr-2" />
                    {t("table.edit")}
                  </Link>
                </DropdownMenuItem>
                {quiz.publicationStatus !== PublicationStatusEnum.ARCHIVED && (
                  <DropdownMenuItem
                    onClick={() => handleArchive(quiz)}
                    className="text-orange-600"
                  >
                    <Archive className="h-4 w-4 mr-2" />
                    {t("table.archive")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];
  }, [handleArchive]);
  const { table } = useDataTable({
    columns,
    data: parsedData,
    pageCount: parsedPageination.pageCount,
    enableGlobalFilter: true,
    initialState: {
      sorting: [{ id: "createdAt", desc: true }],
    },
  });
  const tableState = table.getState();
  const queryParams = useMemo(() => {
    const parsed: QueryParams = {
      pagination: {
        skip: tableState.pagination.pageIndex * tableState.pagination.pageSize,
        take: tableState.pagination.pageSize,
      },
      filter: {
        publicationStatus: Array.isArray(
          tableState.columnFilters.find((filter) => filter.id === "publicationStatus")
            ?.value,
        )
          ? ((
            tableState.columnFilters.find((filter) => filter.id === "publicationStatus")
              ?.value as PublicationStatusEnum[]
          )[0])
          : undefined,
      },
    };
    if (tableState.sorting[0]) {
      parsed.orderBy = {
        field: tableState.sorting[0].id as any,
        direction: tableState.sorting[0].desc ? "desc" : "asc",
      };
    }
    if (debouncedSearchQuery) {
      parsed.search = {
        q: debouncedSearchQuery,
      };
    }
    return parsed;
  }, [
    tableState.sorting,
    tableState.pagination,
    tableState.columnFilters,
    tableState.globalFilter,
    debouncedSearchQuery,
  ]);
  const loadListQuery =
    trpc.lmsModule.quizModule.quiz.list.useQuery(queryParams);
  useEffect(() => {
    if (!loadListQuery.data) return;
    const parsed = loadListQuery.data.items || [];
    setParsedData(parsed);
    setParsedPagination({
      pageCount: Math.ceil(
        (loadListQuery.data.total || 0) / loadListQuery.data.meta.take,
      ),
    });
  }, [loadListQuery.data]);
  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-4">
        <HeaderTopbar
          header={{
            title: t("lms.modules.quizzes.title"),
            subtitle: t("lms.modules.quizzes.description"),
          }}
          rightAction={<CreateButton href="/dashboard/lms/quizzes/new" />}
        />
        <Card>
          <CardContent>
            <div className="flex flex-col gap-2">
              <Input
                placeholder={t("table.search_placeholder")}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-8 w-40 lg:w-56"
              />
              <DataTable table={table}>
                <DataTableToolbar table={table} />
              </DataTable>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardContent>
  );
}
