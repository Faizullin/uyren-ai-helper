"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import { useActivities } from "@/hooks/use-activities";
import { trpc } from "@/utils/trpc";
import { ActivityTypeEnum } from "@workspace/common-logic/lib/ui/activity";
import { useToast } from "@workspace/components-library";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { truncate } from "@workspace/utils";
import {
  BookOpen,
  ChevronDown,
  DollarSign,
  Eye,
  GraduationCap,
  Settings,
  UserPlus
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import MetricCard from "./_components/metric-card";
import SalesCard from "./_components/sales-card";

export default function ProductPage() {
  const [timeRange, setTimeRange] = useState("7d");
  const params = useParams<{
    id: string;
  }>();
  const { toast } = useToast();

  const loadCourseDetailedQuery = trpc.lmsModule.courseModule.course.getById.useQuery({
    id: params.id,
  }, {
    enabled: !!params.id,
  });
  const course = loadCourseDetailedQuery.data;

  const breadcrumbs = [
    { label: "Manage Courses", href: "/dashboard/lms/courses" },
    {
      label: course ? truncate(course.title || "", 20) || "..." : "...",
      href: "#",
    },
  ];

  const { data: salesData, loading: salesLoading } = useActivities(
    ActivityTypeEnum.ENROLLED,
    timeRange,
    course?._id,
    true,
  );

  if (loadCourseDetailedQuery.isLoading || !course) {
    return (
      <DashboardContent breadcrumbs={breadcrumbs}>
        <div className="space-y-8">
          <div className="space-y-4">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </div>
      </DashboardContent>
    );
  }

  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      {!course?.published && (
        <div className="bg-red-400 p-2 mb-4 text-sm text-white rounded-md">
          {course?.published ? "Published" : "Draft"}{" "}
          <Link
            href={`/dashboard/lms/courses/${course._id}/manage#publish`}
            className="underline"
          >
            Manage
          </Link>
        </div>
      )}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-4xl font-semibold flex items-center gap-2">
              {course?.title || <Skeleton className="h-9 w-64" />}
            </h1>
            <div className="flex items-center gap-2">
              {course ? (
                <>
                  <Badge variant="secondary">
                    <BookOpen className="h-4 w-4 mr-1" />
                    Course
                  </Badge>
                  <Badge variant="outline">
                    {course.published ? "Published" : "Draft"}
                  </Badge>
                </>
              ) : (
                <Skeleton className="h-5 w-48" />
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Select value={timeRange} onValueChange={setTimeRange} >
              <SelectTrigger className="w-[140px]" size="sm">
                <SelectValue placeholder="Select time range" />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/dashboard/lms/courses/${course._id}/content`}>
                Edit Content
              </Link>
            </Button>
            <DropdownMenu >
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Actions
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    href={`/dashboard/lms/courses/${course._id}/customers/new`}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Invite a Customer
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/lms/courses/${course._id}/manage`}>
                    <Settings className="mr-2 h-4 w-4" />
                    Manage
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href={`/dashboard/lms/courses/${course._id}/customers`}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Customers
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          title="Sales"
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          type={ActivityTypeEnum.PURCHASED}
          duration={timeRange}
          entityId={course._id}
        />

        <Link href={`/dashboard/lms/courses/${course._id}/customers`}>
          {/* <MetricCard
            title="Customers"
            icon={<Users className="h-4 w-4 text-muted-foreground" />}
            type={ActivityType.ENROLLED}
            duration={timeRange}
            entityId={course._id}
          /> */}
        </Link>
        <MetricCard
          title="People who completed the course"
          icon={<GraduationCap className="h-4 w-4 text-muted-foreground" />}
          type={ActivityTypeEnum.COURSE_COMPLETED}
          duration={timeRange}
          entityId={course._id}
        />
      </div>

      <SalesCard data={salesData} loading={salesLoading} />

      {/* <Resources
        links={[
          {
            href: "https://docs.courselit.app/en/products/overview",
            text: "Product Management Guide",
          },
          {
            href: "https://docs.courselit.app/en/products/content",
            text: "Content Management",
          },
        ]}
      /> */}
    </DashboardContent>
  );
}


const TIME_RANGES = [
  { label: "1d", value: "1d" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];