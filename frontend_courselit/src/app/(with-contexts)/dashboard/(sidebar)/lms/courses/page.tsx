"use client";

import { CourseCard, CourseSkeletonCard } from "@/components/course/course-card";
import DashboardContent from "@/components/dashboard/dashboard-content";
import HeaderTopbar from "@/components/dashboard/layout/header-topbar";
import { trpc } from "@/utils/trpc";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { CourseLevelEnum, CourseStatusEnum } from "@workspace/common-logic/models/lms/course.types";
import { useDialogControl } from "@workspace/components-library";
import { Button } from "@workspace/ui/components/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CourseCreateDialog } from "./_components/course-create-dialog";

const ITEMS_PER_PAGE = 9;


export default function Page() {
  const { t } = useTranslation(["dashboard", "common"]);

  const createCourseDialog = useDialogControl();

  const breadcrumbs = [{ label: t("common:dashboard.courses.title"), href: "#" }];
  const [levelFilter, setLevelFilter] = useState<CourseLevelEnum | "all">("all");
  const [courseStatusFilter, setCourseStatusFilter] = useState<CourseStatusEnum | "all">("all");

  const [page, setPage] = useState(1);
  const listQuery = trpc.lmsModule.courseModule.course.list.useQuery({
    pagination: {
      take: ITEMS_PER_PAGE,
      skip: (page - 1) * ITEMS_PER_PAGE,
    },
    filter: {
      level: levelFilter === "all" ? undefined : levelFilter,
      status: courseStatusFilter === "all" ? undefined : courseStatusFilter,
    },
  });
  const totalPages = useMemo(() => {
    if (!listQuery.data?.total || !ITEMS_PER_PAGE) return 1;
    return Math.ceil(listQuery.data.total / ITEMS_PER_PAGE);
  }, [listQuery.data, ITEMS_PER_PAGE]);
  const courses = useMemo(() => listQuery.data?.items || [], [listQuery.data]);


  return (
    <DashboardContent
      breadcrumbs={breadcrumbs}
      permissions={[UIConstants.permissions.manageAnyCourse, UIConstants.permissions.manageCourse]}
    >
      <div className="flex flex-col gap-4">
        <HeaderTopbar
          header={{
            title: t("lms.modules.courses.title"),
            subtitle: t("lms.modules.courses.description"),
          }}
          rightAction={
            <Button onClick={() => createCourseDialog.show()} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {t("courses.new_course")}
            </Button>
          }
        />
        <CourseCreateDialog control={createCourseDialog} />
        {totalPages > 0 && (
          <div className="flex flex-col sm:flex-row justify-between gap-4">
          <Select value={levelFilter} onValueChange={(value) => setLevelFilter(value as CourseLevelEnum | "all")}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t("courses.filter_by_level")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common:dashboard.select_all")}</SelectItem>
              {[CourseLevelEnum.BEGINNER, CourseLevelEnum.INTERMEDIATE, CourseLevelEnum.ADVANCED].map(
                (level) => (
                  <SelectItem value={level} key={level}>
                    {level === CourseLevelEnum.BEGINNER
                      ? t("courses.status.beginner")
                      : level === CourseLevelEnum.INTERMEDIATE
                        ? t("courses.status.intermediate")
                        : t("courses.status.advanced")}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          <Select value={courseStatusFilter} onValueChange={(value) => setCourseStatusFilter(value as CourseStatusEnum | "all")}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t("courses.filter_by_course_status")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common:dashboard.select_all")}</SelectItem>
              {[CourseStatusEnum.IN_PROGRESS, CourseStatusEnum.UNDER_REVIEW, CourseStatusEnum.APPROVED].map(
                (status) => (
                  <SelectItem value={status} key={status}>
                    {status === CourseStatusEnum.IN_PROGRESS
                      ? t("courses.status.in_progress")
                      : status === CourseStatusEnum.UNDER_REVIEW
                        ? t("courses.status.under_review")
                        : t("courses.status.approved")}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listQuery.isLoading ? (
          <>
            {[...Array(6)].map((_, index) => (
              <CourseSkeletonCard key={index} />
            ))}
          </>
        ) : (
          <>
            {totalPages > 0 && (
              <>
                {courses.map((course, index) => (
                  <Link key={index} href={`/dashboard/lms/courses/${course._id}`}>
                    <CourseCard course={course} />
                  </Link>
                ))}
              </>
            )}
          </>
        )}
        </div>
      </div>
    </DashboardContent>
  );
}
