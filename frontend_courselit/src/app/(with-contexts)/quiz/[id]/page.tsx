import {
  getAttemptStatistics,
  getUserQuizAttempts,
} from "@/server/actions/quiz-attempt";
import { trpcCaller } from "@/server/api/caller";
import { NotFoundException } from "@/server/api/core/exceptions";
import { IQuizAttemptHydratedDocument, QuizAttemptStatusEnum } from "@workspace/common-logic/models/lms/quiz-attempt";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { ArrowLeft, BarChart3, Clock, Eye, Target } from "lucide-react";
import { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import QuizActions from "./_components/quiz-actions";

interface QuizPageProps {
  params: Promise<{ id: string }>;
}

const getCachedData = cache(async (id: string) => {
  return await trpcCaller.lmsModule.quizModule.quiz.protectedGetById({
    id,
  });
});

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params;
  const quiz = await getCachedData(id);

  if (!quiz) {
    return {
      title: `Quiz Not Found | Quizzes | LMS | ${(await parent)?.title?.absolute}`,
    };
  }
  return {
    title: `${quiz.title} | Quizzes | LMS | ${(await parent)?.title?.absolute}`,
    description: quiz.description || `Take the ${quiz.title} quiz`,
  };
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { id } = await params;

  try {
    const quiz = await getCachedData(id);

    let attemptStats = null;
    let userAttempts: IQuizAttemptHydratedDocument[] = [];

    try {
      [attemptStats, userAttempts] = await Promise.all([
        getAttemptStatistics(id),
        getUserQuizAttempts(id),
      ]);
    } catch (error) {
      console.warn("Failed to load attempt data:", error);
    }

    const currentAttempt = userAttempts.find(
      (attempt) => attempt.status === QuizAttemptStatusEnum.IN_PROGRESS,
    );

    const getRemainingAttempts = () => {
      if (!quiz.maxAttempts) return Infinity;
      return Math.max(0, quiz.maxAttempts - (attemptStats?.totalAttempts || 0));
    };

    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          {/* Back Navigation */}
          <div className="mb-6">
            <Link
              href="/courses"
              className="inline-flex items-center text-muted-foreground hover:text-brand-primary transition-colors duration-300"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Courses
            </Link>
          </div>

          {/* Main Quiz Card */}
          <Card className="max-w-4xl mx-auto shadow-lg border-0 bg-card/50 backdrop-blur-sm">
            <CardHeader className="text-center pb-8">
              <div className="space-y-4">
                <Badge className="bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 text-sm font-semibold px-4 py-2">
                  Quiz Assessment
                </Badge>
                <CardTitle className="text-3xl lg:text-4xl font-bold text-foreground leading-tight">
                  {quiz.title}
                </CardTitle>
                {quiz.description && (
                  <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                    {quiz.description}
                  </p>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-8 px-8 pb-8">
              {/* Quiz Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="group bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 p-6 rounded-xl text-center border border-blue-200/50 dark:border-blue-800/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors duration-300">
                      <Target className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                    {quiz.passingScore}%
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">
                    Passing Score
                  </div>
                </div>

                <div className="group bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/20 dark:to-green-900/20 p-6 rounded-xl text-center border border-green-200/50 dark:border-green-800/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-800/40 transition-colors duration-300">
                      <Clock className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                    {quiz.timeLimit ? `${quiz.timeLimit} min` : "No limit"}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">
                    Time Limit
                  </div>
                </div>

                <div className="group bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/20 dark:to-purple-900/20 p-6 rounded-xl text-center border border-purple-200/50 dark:border-purple-800/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                  <div className="flex items-center justify-center mb-3">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40 transition-colors duration-300">
                      <BarChart3 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                    {quiz.totalPoints}
                  </div>
                  <div className="text-sm text-muted-foreground font-medium">
                    Total Points
                  </div>
                </div>
              </div>

              {/* Progress Summary */}
              {attemptStats && (
                <div className="bg-muted/50 p-6 rounded-xl border border-border/50">
                  <h3 className="font-semibold text-lg mb-4 text-foreground">
                    Your Progress
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Attempts Used
                        </span>
                        <span className="font-semibold text-foreground">
                          {attemptStats.totalAttempts}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          Remaining
                        </span>
                        <span className="font-semibold text-foreground">
                          {getRemainingAttempts()}
                        </span>
                      </div>
                    </div>

                    <div>
                      {userAttempts.length > 0 && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            Total Attempts
                          </span>
                          <span className="font-semibold text-foreground">
                            {userAttempts.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <QuizActions
                  quizId={id}
                  currentAttempt={currentAttempt}
                  remainingAttempts={getRemainingAttempts()}
                />
              </div>

              {/* Attempt Limit Warning */}
              {getRemainingAttempts() === 0 && (
                <div className="text-center p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm text-destructive font-medium">
                    You have used all available attempts for this quiz.
                  </p>
                </div>
              )}

              {/* Quick Attempt History */}
              {userAttempts.length > 0 && (
                <div className="border-t border-border/50 pt-8">
                  <h3 className="font-semibold text-lg mb-6 text-foreground">
                    Recent Attempts
                  </h3>
                  <div className="space-y-3">
                    {userAttempts.slice(0, 3).map((attempt) => (
                      <div
                        key={`${attempt._id}`}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors duration-300"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`w-3 h-3 rounded-full ${attempt.status === QuizAttemptStatusEnum.COMPLETED
                              ? "bg-green-500"
                              : attempt.status === QuizAttemptStatusEnum.IN_PROGRESS
                                ? "bg-brand-primary"
                                : "bg-muted-foreground"
                              }`}
                          />
                          <span className="text-sm font-medium text-foreground">
                            {new Date(attempt.startedAt).toLocaleDateString()}
                          </span>
                          <Badge
                            variant={
                              attempt.status === QuizAttemptStatusEnum.COMPLETED
                                ? "default"
                                : "secondary"
                            }
                          >
                            {attempt.status.replace("_", " ")}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-4">
                          {attempt.percentageScore !== undefined && (
                            <span className="text-sm font-semibold text-foreground">
                              {Math.round(attempt.percentageScore)}%
                            </span>
                          )}
                          {attempt.status === QuizAttemptStatusEnum.IN_PROGRESS ? (
                            <Link href={`/quiz/${id}/attempts/${attempt._id}`}>
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
                              >
                                Continue
                              </Button>
                            </Link>
                          ) : (
                            <Link
                              href={`/quiz/${id}/attempts/${attempt._id}/results`}
                            >
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
                              >
                                View Results
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* View All Results Link */}
                  {userAttempts.length > 3 && (
                    <div className="mt-6 text-center">
                      <Link
                        href={`/quiz/${id}/attempts/${userAttempts[0]!._id}/results`}
                      >
                        <Button
                          variant="outline"
                          className="w-full border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View All Results & Attempt History
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  } catch (error) {
    if (error instanceof NotFoundException) {
      notFound();
    }
    throw error;
  }
}
