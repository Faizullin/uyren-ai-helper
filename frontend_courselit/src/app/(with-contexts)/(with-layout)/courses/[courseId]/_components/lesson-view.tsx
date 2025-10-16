"use client";

import { useProfile } from "@/components/contexts/profile-context";
import { ScrollAnimation } from "@/components/public/scroll-animation";
import { trpc } from "@/utils/trpc";
import { Editor } from "@tiptap/react";
import { Constants, TextEditorContent } from "@workspace/common-models";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent } from "@workspace/ui/components/card";
import { ArrowRight, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { memo, Suspense, useRef } from "react";
import { useCourseData } from "./course-provider";
import { LessonContentSkeleton } from "./course-skeletons";
import { CourseErrorBoundary, CourseErrorFallback } from "./course-error-boundary";

const LessonContentEditor = dynamic(
  () =>
    import(
      "@/components/editors/tiptap/templates/lesson-content/lesson-content-editor"
    ).then((mod) => ({ default: mod.LessonContentEditor })),
  { ssr: false },
);

const useLessonAccess = (courseId: string) => {
  const { profile } = useProfile();

  const { data: membershipStatus, isLoading: isMembershipLoading } =
    trpc.userModule.user.getMembershipStatus.useQuery(
      {
        entityId: courseId,
        entityType: Constants.MembershipEntityType.COURSE,
      },
      {
        enabled: !!courseId && !!profile?.userId,
        retry: false,
      },
    );

  const isAuthenticated = !!profile?.userId;
  const hasAccess =
    isAuthenticated && membershipStatus === Constants.MembershipStatus.ACTIVE;

  return {
    isAuthenticated,
    hasAccess,
    isMembershipLoading,
  };
};

const canAccessLesson = (lesson: any, hasAccess: boolean) => {
  return hasAccess || !lesson?.requiresEnrollment;
};

function LessonMain({
  courseId,
  lessonId,
  course,
  hasAccess,
}: {
  courseId: string;
  lessonId: string;
  course: ReturnType<typeof useCourseData>;
  hasAccess: boolean;
}) {
  const { data } = trpc.lmsModule.courseModule.lesson.publicGetById.useQuery(
    { courseId, lessonId },
    {
      enabled: !!(courseId && lessonId), suspense: true,
      retry: false,
    },
  );
  const lesson = data!;

  const prevLesson = lesson?.meta?.prevLesson
    ? course?.attachedLessons?.find((l) => l.lessonId === lesson.meta.prevLesson)
    : null;
  const nextLesson = lesson?.meta?.nextLesson
    ? course?.attachedLessons?.find((l) => l.lessonId === lesson.meta.nextLesson)
    : null;

  return (
    <>
      {/* Lesson Content */}
      <ScrollAnimation variant="fadeUp">
        <Card className="border-0 shadow-sm m--lesson-content-card">
          <CardContent>
            <div className="space-y-6">
              {lesson.media?.thumbnail && (
                <div className="aspect-video bg-muted rounded-lg overflow-hidden">
                  <img
                    src={lesson.media.thumbnail}
                    alt={lesson.media.caption || "Lesson thumbnail"}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <LessonContentRender content={lesson.content as TextEditorContent} />
            </div>
          </CardContent>
        </Card>
      </ScrollAnimation>

      {/* Navigation */}
      <ScrollAnimation variant="fadeUp">
        <div className="flex justify-between items-center pt-8 border-t m--lesson-navigation">
          {lesson.meta?.prevLesson ? (
            canAccessLesson(prevLesson, hasAccess) ? (
              <Link
                href={`/courses/${courseId}/lessons/${lesson.meta.prevLesson}`}
                className="flex items-center text-brand-primary hover:text-brand-primary-hover transition-colors"
                scroll={false}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous Lesson
              </Link>
            ) : (
              <div className="flex items-center text-muted-foreground opacity-60">
                <Lock className="h-4 w-4 mr-1" />
                Previous Lesson
              </div>
            )
          ) : (
            <div></div>
          )}

          {lesson.meta?.nextLesson ? (
            canAccessLesson(nextLesson, hasAccess) ? (
              <Link
                href={`/courses/${courseId}/lessons/${lesson.meta.nextLesson}`}
                className="flex items-center text-brand-primary hover:text-brand-primary-hover transition-colors"
                scroll={false}
              >
                Next Lesson
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            ) : (
              <div className="flex items-center text-muted-foreground opacity-60">
                Next Lesson
                <Lock className="h-4 w-4 ml-1" />
              </div>
            )
          ) : (
            <Link href={`/courses/${courseId}`} scroll={false}>
              <Button className="flex items-center gap-2 bg-[rgb(var(--brand-primary))] hover:bg-[rgb(var(--brand-primary-hover))] text-white">
                Back to Course
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </ScrollAnimation>
    </>
  );
}

function LessonContent() {
  const params = useParams();
  const courseId = params.courseId as string;
  const lessonId = params.lessonId as string;
  const course = useCourseData();
  const { hasAccess } = useLessonAccess(courseId);

  return (
    <CourseErrorBoundary fallback={<CourseErrorFallback error={new Error("Failed to load lesson")} reset={() => window.location.reload()} />}>
      <Suspense fallback={<LessonContentSkeleton />}>
        <LessonMain
          courseId={courseId}
          lessonId={lessonId}
          course={course}
          hasAccess={hasAccess}
        />
      </Suspense>
    </CourseErrorBoundary>
  );
}

export default function LessonView() {
  return <LessonContent />;
}

const LessonContentRender = memo((props: { content: TextEditorContent }) => {
  const editorRef = useRef<Editor | null>(null);
  return (
    <LessonContentEditor
      editable={false}
      toolbar={false}
      onEditor={(editor, meta) => {
        if (meta.reason === "create") {
          editorRef.current = editor;
          editor!.commands.setMyContent(props.content);
        }
      }}
    />
  );
});
