"use client";

import DashboardContent from "@/components/dashboard/dashboard-content";
import { CourseCardContent } from "@/components/course/course-card";
import { trpc } from "@/utils/trpc";
import { Badge } from "@workspace/ui/components/badge";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { BookOpen, CheckCircle, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function Page() {
  const { t } = useTranslation("dashboard");
  const breadcrumbs = [{ label: t("my_progress.title"), href: "#" }];

  const attemptsQuery = trpc.lmsModule.quizModule.quizAttempt.listMine.useQuery({
    filter: { passed: true },
    pagination: { skip: 0, take: 12 },
  });

  const submissionsQuery = trpc.lmsModule.assignmentModule.assignmentSubmission.listMine.useQuery({
    filter: { status: "graded" },
    pagination: { skip: 0, take: 12 },
  });

  const isLoading = attemptsQuery.isLoading || submissionsQuery.isLoading;

  const attempts = attemptsQuery.data?.items ?? [];
  const submissions = submissionsQuery.data?.items ?? [];

  return (
    <DashboardContent breadcrumbs={breadcrumbs}>
      <div className="space-y-12">
        <h1 className="text-4xl font-bold">{t("my_progress.title")}</h1>

        <section>
          <h2 className="text-xl font-semibold mb-6">{t("my_progress.quizzes")}</h2>
          {(!isLoading && attempts.length === 0) ? (
            <EmptyState icon={<CheckCircle className="w-12 h-12 text-muted-foreground" />} text="No passed quizzes yet." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                <>{[...Array(6)].map((_, i) => (<SkeletonCard key={i} />))}</>
              ) : (
                <>
                  {attempts.map((a, index) => (
                    <Link href={`/quiz/${a.quizId}`} key={index}>
                      <CourseCardContent.Card >
                        <CourseCardContent.CardContent>
                          <CourseCardContent.CardHeader>{a.quiz?.title || "Quiz"}</CourseCardContent.CardHeader>
                          <div className="mt-2 flex items-center gap-2">
                            <Badge variant="secondary"><BookOpen className="h-4 w-4 mr-1" />Quiz</Badge>
                            {typeof a.percentageScore === "number" && (
                              <span className="text-sm text-muted-foreground">{Math.round(a.percentageScore)}%</span>
                            )}
                          </div>
                        </CourseCardContent.CardContent>
                      </CourseCardContent.Card>
                    </Link>
                  ))}
                </>
              )}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-6">{t("my_progress.assignments")}</h2>
          {(!isLoading && submissions.length === 0) ? (
            <EmptyState icon={<ClipboardList className="w-12 h-12 text-muted-foreground" />} text="No graded assignments yet." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                <>{[...Array(6)].map((_, i) => (<SkeletonCard key={i} />))}</>
              ) : (
                <>
                  {submissions.map((s: any) => (
                    <CourseCardContent.Card key={s._id}>
                      <CourseCardContent.CardContent>
                        <CourseCardContent.CardHeader>{s.assignment?.title || "Assignment"}</CourseCardContent.CardHeader>
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="secondary"><ClipboardList className="h-4 w-4 mr-1" />Assignment</Badge>
                          {typeof s.percentageScore === "number" ? (
                            <span className="text-sm text-muted-foreground">{Math.round(s.percentageScore)}%</span>
                          ) : typeof s.score === "number" ? (
                            <span className="text-sm text-muted-foreground">{s.score}</span>
                          ) : null}
                        </div>
                      </CourseCardContent.CardContent>
                    </CourseCardContent.Card>
                  ))}
                </>
              )}
            </div>
          )}
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

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-12">
      <div className="flex justify-center mb-4">{icon}</div>
      <p className="text-muted-foreground mb-2">{text}</p>
    </div>
  );
}

