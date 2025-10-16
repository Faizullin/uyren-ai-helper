import { getQuizAttempt } from "@/server/actions/quiz-attempt";
import { trpcCaller } from "@/server/api/caller";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import { ArrowLeft } from "lucide-react";
import { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import QuizInterface from "../../_components/quiz-interface";

interface QuizAttemptPageProps {
  params: Promise<{ id: string; attemptId: string }>;
}

const getCachedData = cache(async (id: string) => {
  return await trpcCaller.lmsModule.quizModule.quiz.protectedGetByIdWithQuestions({
    id, 
  });
});

export async function generateMetadata(
  { params }: { params: Promise<{ id: string; attemptId: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id, attemptId } = await params;

  try {
    const quiz = await getCachedData(id);
    return {
      title: `${quiz.title} - Attempt ${attemptId} | Quizzes | LMS | ${(await parent)?.title?.absolute}`,
      description: `Take the ${quiz.title} quiz`,
    };
  } catch (error) {
    return {
      title: `Quiz Attempt | Quizzes | LMS | ${(await parent)?.title?.absolute}`,
    };
  }
}

export default async function QuizAttemptPage({
  params,
}: QuizAttemptPageProps) {
  const { id, attemptId } = await params;

  try {
    const quiz = await getCachedData(id);
    const attempt = await getQuizAttempt(attemptId);
    if (!attempt) {
      notFound();
    }
    if (attempt.quizId?.toString() !== id) {
      notFound();
    }
    const serializedQuiz = {
      _id: quiz._id?.toString(),
      title: quiz.title,
      description: quiz.description,
      maxAttempts: quiz.maxAttempts,
      timeLimit: quiz.timeLimit,
      totalPoints: quiz.totalPoints,
      questions: quiz.questions.map((question) => ({
        _id: question._id?.toString(),
        text: question.text,
        type: question.type,
        points: question.points,
        options: question.options?.map((option) => ({
          text: option.text,
          uid: option.uid,
        })) || [],
      })),
    };

    const serializedAttempt = {
      _id: attempt._id?.toString() || attemptId,
      quizId: attempt.quizId?.toString() || id,
      userId: attempt.userId?.toString() || "",
      status: attempt.status,
      startedAt: attempt.startedAt?.toISOString(),
      expiresAt: attempt.expiresAt?.toISOString(),
      answers:
        attempt.answers?.map((answer) => ({
          questionId: answer.questionId?.toString(),
          answer: answer.answer,
        })) || [],
      timeSpent: attempt.timeSpent,
    };

    if (
      serializedAttempt.status === "completed" ||
      serializedAttempt.status === "graded"
    ) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">
                Quiz Already Completed
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">
                This quiz attempt has already been completed.
              </p>
              <Link
                href={`/quiz/${serializedQuiz._id}/attempts/${serializedAttempt._id}/results`}
              >
                View Results
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (serializedAttempt.status === "abandoned") {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <Card className="w-full max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center text-red-600">
                Attempt Abandoned
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-gray-600 mb-4">
                This quiz attempt has been abandoned and cannot be continued.
              </p>
              <Link href={`/quiz/${serializedQuiz._id}`}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Quiz
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <QuizInterface
        initialQuiz={serializedQuiz}
        initialAttemptData={serializedAttempt}
        attemptId={attemptId}
      />
    );
  } catch (error) {
    console.error("Error loading quiz attempt:", error);
    // If there's a serialization error, it's likely due to ObjectId issues
    if (error instanceof Error && error.message.includes("toJSON")) {
      console.error("Serialization error - ObjectId conversion failed");
    }
    notFound();
  }
}
