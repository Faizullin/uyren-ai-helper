"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import { CourseCardContent } from "@/components/course/course-card";
import { trpc } from "@/utils/trpc";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { cn } from "@workspace/ui/lib/utils";
import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";


export default function Page() {
  const { t } = useTranslation("dashboard");
  const breadcrumbs = [{ label: t("my_content.title"), href: "#" }];
  const [data, setData] = useState<ContentItem[]>([]);

  const loadUserContentQuery =
    trpc.userModule.userContent.getMyContent.useQuery();

  useEffect(() => {
    if (loadUserContentQuery.data) {
      setData(loadUserContentQuery.data as unknown as ContentItem[]);
    }
  }, [loadUserContentQuery.data]);

  const courses = data.filter(
    (item) => item.entityType === MembershipEntityType.COURSE,
  );

  const isLoading = loadUserContentQuery.isLoading;

  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <div className="space-y-12">
        <h1 className="text-4xl font-bold">{t("my_content.title")}</h1>

        <section>
          <h2 className="text-xl font-semibold mb-6">
            {t("my_content.courses")}
          </h2>
          {
            (!isLoading && courses.length === 0) ? (
              <EmptyStateMessage />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {
                  isLoading ? (
                    <>
                      {[...Array(6)].map((_, index) => (
                        <SkeletonCard key={index} />
                      ))}
                    </>
                  ) : (
                    <>
                      {courses.map((item) => (
                        <MyContentCard key={item.entity.id} item={item} />
                      ))}
                    </>
                  )
                }
              </div>
            )
          }
        </section>
      </div>
    </DashboardContent>
  );
}

function SkeletonCard() {
  return (
    <CourseCardContent.Card>
      <Skeleton className="h-48 w-full" />
      <CourseCardContent.CardContent>
        <Skeleton className="h-6 w-3/4 mb-4" />
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </CourseCardContent.CardContent>
    </CourseCardContent.Card>
  );
}

const EmptyStateMessage = () => {
  const { t } = useTranslation(["dashboard", "common"]);

  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-4">
        <BookOpen className="w-12 h-12 text-muted-foreground" />
      </div>
      <p className="text-muted-foreground mb-4">
        {t("my_content.no_courses")}
      </p>
      <Link href="/courses" className="text-primary">
        <Button size="sm">{t("my_content.browse_courses")}</Button>
      </Link>
    </div>
  );
};


interface ContentItem {
  entity: {
    id: string;
    title: string;
    slug?: string;
    membersCount?: number;
    totalLessons?: number;
    completedLessonsCount?: number;
    featuredImage: {
      file: string;
      thumbnail: string;
    };
  };
  entityType: "community" | "course";
}

interface ContentCardProps {
  item: ContentItem;
}

function MyContentCard({ item }: ContentCardProps) {
  const { t } = useTranslation(["dashboard", "common"]);
  const { entity, entityType } = item;
  const progress =
    entity.totalLessons && entity.completedLessonsCount
      ? (entity.completedLessonsCount / entity.totalLessons) * 100
      : 0;

  const href = `/courses/${entity.id}`;

  return (
    <Link href={href} className="cursor-pointer">
      <CourseCardContent.Card
        key={item.entity.id}
      >
        <CourseCardContent.CardImage
          src={item.entity.featuredImage?.file}
          alt={item.entity.title}
        />
        <CourseCardContent.CardContent>
          <CourseCardContent.CardHeader>{item.entity.title}</CourseCardContent.CardHeader>
          <>
            <Badge variant="secondary">
              <BookOpen className="h-4 w-4 mr-1" />
              {t("my_content.courses")}
            </Badge>
          </>
          {entity.totalLessons ? (
            <div className="space-y-2 mt-4">
              <ProgressBar value={progress} />
              <p className="text-sm text-muted-foreground flex justify-between">
                <span>{t("my_content.lessons_completed", {
                  completed: entity.completedLessonsCount,
                  total: entity.totalLessons
                })}</span>
                <span>{`${Math.round(progress)}%`}</span>
              </p>
            </div>
          ) : (
            <></>
          )}
        </CourseCardContent.CardContent>
      </CourseCardContent.Card>
    </Link>
  );
}

function ProgressBar({ value, className }: {
  value: number;
  className?: ReturnType<typeof cn>;
}) {
  return (
    <div className={cn(`h-2 w-full bg-gray-100 rounded-full`, className)}>
      <div
        className="h-full bg-primary rounded-full transition-all duration-300 ease-in-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}
