"use client";

import { useProfile } from "@/components/contexts/profile-context";
import DashboardContent from "@/components/dashboard/dashboard-content";
import HeaderTopbar from "@/components/dashboard/layout/header-topbar";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableToolbar } from "@/components/data-table/data-table-toolbar";
import { useDataTable } from "@/components/data-table/use-data-table";
import { formattedLocaleDate } from "@/lib/ui/utils";
import { GeneralRouterOutputs } from "@/server/api/types";
import { trpc } from "@/utils/trpc";
import { type ColumnDef } from "@tanstack/react-table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Card, CardContent } from "@workspace/ui/components/card";
import { Input } from "@workspace/ui/components/input";
import { useDebounce } from "@workspace/ui/hooks/use-debounce";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

type UserItemType =
  GeneralRouterOutputs["userModule"]["user"]["list"]["items"][number];
type QueryParams = Parameters<
  typeof trpc.userModule.user.list.useQuery
>[0];

export default function UsersHub() {
  const { t } = useTranslation(["dashboard", "common"]);
  const breadcrumbs = [{ label: t("sidebar.users"), href: "#" }];
  const { profile } = useProfile();

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 500);
  const [parsedData, setParsedData] = useState<Array<UserItemType>>([]);
  const [parsedPagination, setParsedPagination] = useState({
    pageCount: 1,
  });

  const getUserNamePreview = (user?: UserItemType) => {
    if (!user?.firstName || !user?.lastName) return user?.email?.charAt(0) || "";
    return (user.firstName.charAt(0) + user.lastName.charAt(0)).toUpperCase();
  };

  const columns: ColumnDef<UserItemType>[] = useMemo(() => {
    return [
      {
        accessorKey: "username",
        header: t("users.table.name"),
        cell: ({ row }) => {
          const user = row.original;
          const username = user.username || user.email;
          const fullName = user.fullName;
          return (
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarImage
                  src={
                    user.avatar
                      ? user.avatar.url
                      : "/courselit_backdrop_square.webp"
                  }
                />
                <AvatarFallback>
                  {getUserNamePreview(user)}
                </AvatarFallback>
              </Avatar>
              <div>
                <Link href={`/dashboard/users/admin/${user._id}`}>
                  <span className="font-medium text-base">
                    {fullName}
                  </span>
                </Link>
                <div className="text-xs text-muted-foreground">
                  {user.email}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "active",
        header: t("users.table.status"),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <Badge variant={user.active ? "default" : "secondary"}>
              {user.active ? "Active" : "Restricted"}
            </Badge>
          );
        },
      },
      {
        accessorKey: "createdAt",
        header: t("users.table.joined"),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {user.createdAt ? formattedLocaleDate(user.createdAt) : ""}
            </div>
          );
        },
      },
      {
        accessorKey: "updatedAt",
        header: t("users.table.last_active"),
        cell: ({ row }) => {
          const user = row.original;
          return (
            <div className="text-sm text-muted-foreground">
              {user.updatedAt !== user.createdAt && user.updatedAt
                ? formattedLocaleDate(user.updatedAt)
                : ""}
            </div>
          );
        },
      },
    ];
  }, [t]);

  const { table } = useDataTable({
    columns,
    data: parsedData,
    pageCount: parsedPagination.pageCount,
    enableGlobalFilter: false,
  });

  const tableState = table.getState();

  const queryParams = useMemo(() => {
    const parsed: QueryParams = {
      pagination: {
        skip: tableState.pagination.pageIndex * tableState.pagination.pageSize,
        take: tableState.pagination.pageSize,
      },
    };

    if (tableState.sorting[0]) {
      parsed.orderBy = {
        field: tableState.sorting[0].id,
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
    debouncedSearchQuery,
  ]);

  const loadUsersQuery = trpc.userModule.user.list.useQuery(queryParams);

  useEffect(() => {
    if (!loadUsersQuery.data) return;
    const parsed = loadUsersQuery.data.items || [];
    setParsedData(parsed);
    setParsedPagination({
      pageCount: Math.ceil(
        (loadUsersQuery.data.total || 0) / loadUsersQuery.data.meta.take,
      ),
    });
  }, [loadUsersQuery.data]);

  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <div className="flex flex-col gap-4">
        <HeaderTopbar
          header={{
            title: t("sidebar.users"),
          }}
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
