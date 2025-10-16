import { router } from "@/server/api/core/trpc";
import { quizRouter } from "./quiz";
import { quizAttemptRouter } from "./quiz-attempt";
import { quizQuestionsRouter } from "./quiz-questions";

export const quizModuleRouter = router({
  quiz: quizRouter,
  quizAttempt: quizAttemptRouter,
  quizQuestions: quizQuestionsRouter,
});
