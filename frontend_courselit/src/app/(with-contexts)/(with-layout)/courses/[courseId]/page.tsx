"use client";

import { ScrollAnimation } from "@/components/public/scroll-animation";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { BookOpen, Clock } from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { useCourseData } from "./_components/course-provider";
import { CourseDetailSkeleton } from "./_components/course-skeletons";
import { CourseErrorBoundary, CourseErrorFallback } from "./_components/course-error-boundary";

const DescriptionEditor = dynamic(
  () =>
    import(
      "@/components/editors/tiptap/templates/description/description-editor"
    ).then((mod) => ({ default: mod.DescriptionEditor })),
  {
    ssr: false,
  },
);

function CourseMainContent({ course }: { course: any }) {
  const { t } = useTranslation("common");

  return (
    <>
      {/* Course Header */}
      <ScrollAnimation variant="fadeUp">
        <div className="space-y-4 m--course-header">
          <div className="flex flex-wrap items-center gap-4 text-sm m--course-meta">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-brand-primary" />
              <span>
                {course.duration || "~"} {t("weeks")}
              </span>
            </div>
            <Badge
              variant="secondary"
              className="bg-brand-primary/10 text-brand-primary border-brand-primary/20"
            >
              {course.level || "Beginner"}
            </Badge>
          </div>
        </div>
      </ScrollAnimation>

      {/* Course Card with Image, Overview and Description */}
      <ScrollAnimation variant="fadeUp">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm m--course-overview">
          {/* Featured Image */}
          {course.featuredImage && (
            <div className="relative w-full h-64 md:h-80 rounded-t-lg overflow-hidden">
              <Image
                src={
                  course.featuredImage.url ||
                  course.featuredImage.thumbnail ||
                  "/placeholder-course.jpg"
                }
                alt={course.featuredImage.caption || course.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          )}

          {/* Course Title */}
          <div className="p-6 pb-0">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 m--course-title">
              {course.title}
            </h1>

            {/* Course Tags */}
            {course.tags && course.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {course.tags.map((tag: string, index: number) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="border-b border-gray-100 dark:border-gray-700 p-6 m--overview-header">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-br from-brand-primary to-orange-600 rounded-lg flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {t("course_overview")}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {t("course_overview_desc")}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6 m--overview-content">
            <div className="space-y-3 m--description-block">
              {course.description && (
                <DescriptionEditor
                  editable={false}
                  toolbar={false}
                  onEditor={(editor, meta) => {
                    if (meta.reason === "create") {
                      editor!.commands.setMyContent(course.description!);
                    }
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </ScrollAnimation>
    </>
  );
}

function CourseDetailsContent() {
  const { t } = useTranslation("common");
  const course = useCourseData();

  if (!course) {
    return (
      <div className="text-center py-20">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          {t("course_not_found")}
        </h1>
        <p className="text-muted-foreground mb-4">{t("course_not_exist")}</p>
        <Link href="/courses">
          <Button className="bg-[rgb(var(--brand-primary))] hover:bg-[rgb(var(--brand-primary-hover))] text-white">
            {t("back_to_courses")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <CourseErrorBoundary fallback={<CourseErrorFallback error={new Error("Failed to load course content")} reset={() => window.location.reload()} />}>
      <Suspense fallback={<CourseDetailSkeleton />}>
        <CourseMainContent course={course} />
      </Suspense>
    </CourseErrorBoundary>
  );
}

export default function CourseDetailsPage() {
  return <CourseDetailsContent />;
}
