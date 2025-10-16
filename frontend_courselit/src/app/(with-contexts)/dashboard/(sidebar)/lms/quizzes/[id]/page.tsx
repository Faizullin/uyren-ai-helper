import { connectToDatabase } from "@workspace/common-logic/lib/db";
import { QuizModel } from "@workspace/common-logic/models/lms/quiz.model";
import { Metadata, ResolvingMetadata } from "next";
import QuizClientWrapper from "../_components/quiz-client-wrapper";

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> },
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { id } = await params;
  const title = id === "new" ? "New Quiz" : `Quiz ${id}`;
  return {
    title: `${title} | Quizzes | LMS | ${(await parent)?.title?.absolute}`,
  };
}

async function getQuizData(id: string) {
  if (id === "new") {
    return null;
  }

  try {
    await connectToDatabase();
    const quiz = await QuizModel.findById(id).lean();
    return quiz
      ? JSON.parse(
        JSON.stringify({
          ...quiz,
        }),
      )
      : null;
  } catch (error) {
    console.error("Error fetching quiz:", error);
    return null;
  }
}

export default async function EditQuizPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const quizId = params.id !== "new" ? params.id : null;
  const initialMode = quizId !== null ? "edit" : "create";
  const initialQuizData = quizId ? await getQuizData(params.id) : null;
  return (
    <QuizClientWrapper
      initialMode={initialMode}
      initialQuizData={initialQuizData}
    />
  );
}
