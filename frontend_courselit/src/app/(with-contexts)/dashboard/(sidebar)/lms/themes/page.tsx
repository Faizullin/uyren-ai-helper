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
import { Edit, MoreHorizontal, Palette, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

const breadcrumbs = [
  { label: "LMS", href: "#" },
  { label: "Themes", href: "#" },
];

type ItemType =
  GeneralRouterOutputs["lmsModule"]["themeModule"]["theme"]["list"]["items"][number];
type QueryParams = Parameters<
  typeof trpc.lmsModule.themeModule.theme.list.useQuery
>[0];

export default function Page() {
  const { t } = useTranslation("dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [parsedData, setParsedData] = useState<Array<ItemType>>([]);
  const [parsedPagination, setParsedPagination] = useState({
    pageCount: 1,
  });

  const deleteMutation = trpc.lmsModule.themeModule.theme.delete.useMutation({
    onSuccess: () => {
      loadListQuery.refetch();
    },
  });

  const handleDelete = useCallback(
    (theme: ItemType) => {
      if (confirm("Are you sure you want to delete this theme?")) {
        deleteMutation.mutate({
          id: theme._id,
        });
      }
    },
    [deleteMutation],
  );

  const columns: ColumnDef<ItemType>[] = useMemo(() => {
    return [
      {
        accessorKey: "name",
        header: t("table.title"),
        cell: ({ row }) => {
          const theme = row.original;
          return (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/20 rounded flex items-center justify-center">
                <Palette className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <div className="font-medium">{theme.name}</div>
                <div className="text-sm text-muted-foreground">
                  {theme.description || "No description"}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: t("table.status"),
        cell: ({ row }) => {
          const status = row.original.publicationStatus;
          return (
            <Badge
              variant={
                status === PublicationStatusEnum.PUBLISHED
                  ? "default"
                  : status === PublicationStatusEnum.DRAFT
                    ? "secondary"
                    : "destructive"
              }
            >
              <div className="flex items-center gap-1">
                {status === PublicationStatusEnum.PUBLISHED
                  ? t("table.published")
                  : status === PublicationStatusEnum.DRAFT
                    ? t("table.draft")
                    : t("table.archived")}
              </div>
            </Badge>
          );
        },
        meta: {
          label: t("table.status"),
          variant: "select",
          options: [
            { label: t("table.draft"), value: PublicationStatusEnum.DRAFT },
            {
              label: t("table.published"),
              value: PublicationStatusEnum.PUBLISHED,
            },
            {
              label: t("table.archived"),
              value: PublicationStatusEnum.ARCHIVED,
            },
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
          const theme = row.original;
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
                  <Link href={`/dashboard/lms/themes/${theme._id}`}>
                    <Edit className="h-4 w-4 mr-2" />
                    {t("table.edit")}
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => handleDelete(theme)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("table.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];
  }, [handleDelete]);

  const { table } = useDataTable({
    columns,
    data: parsedData,
    pageCount: parsedPagination.pageCount,
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
          ? (
            tableState.columnFilters.find((filter) => filter.id === "publicationStatus")
              ?.value as PublicationStatusEnum[]
          )[0]
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
    trpc.lmsModule.themeModule.theme.list.useQuery(queryParams);

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
            title: t("lms.modules.themes.title"),
            subtitle: t("lms.modules.themes.description"),
          }}
          rightAction={<CreateButton href="/dashboard/lms/themes/new" />}
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
