"use client";

import { ScrollAnimation } from "@/components/public/scroll-animation";
import { trpc } from "@/utils/trpc";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslation } from "react-i18next";
import { useCourseData } from "./course-provider";

interface CourseBreadcrumbsProps {
    courseId: string;
}

export default function CourseBreadcrumbs({ courseId }: CourseBreadcrumbsProps) {
    const { t } = useTranslation("common");
    const course = useCourseData();
    const params = useParams();
    const pathname = usePathname();

    const lessonId = params.lessonId as string;
    const isLessonPage = pathname.includes('/lessons/');

    // Get lesson data if on lesson page
    const { data: lesson } = trpc.lmsModule.courseModule.lesson.publicGetById.useQuery(
        { courseId, lessonId },
        {
            enabled: !!(courseId && lessonId && isLessonPage),
            retry: false,
        },
    );

    return (
        <ScrollAnimation variant="fadeUp">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6 m--breadcrumbs">
                <Link
                    href="/"
                    className="hover:text-brand-primary transition-colors"
                >
                    {t("home")}
                </Link>
                <span>/</span>
                <Link
                    href="/courses"
                    className="hover:text-brand-primary transition-colors"
                >
                    {t("courses")}
                </Link>
                <span>/</span>
                <Link
                    href={`/courses/${courseId}`}
                    className="hover:text-brand-primary transition-colors"
                >
                    {course?.title || "Course"}
                </Link>
                {isLessonPage && (
                    <>
                        <span>/</span>
                        <span className="text-foreground font-medium">
                            {lesson?.title || "Lesson"}
                        </span>
                    </>
                )}
            </div>
        </ScrollAnimation>
    );
} 