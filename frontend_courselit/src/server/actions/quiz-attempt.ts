"use server";

import { authOptions } from "@/lib/auth/options";
import {
  AuthenticationException,
  ConflictException,
  NotFoundException,
  ValidationException,
} from "@/server/api/core/exceptions";
import { QuestionProviderFactory } from "@/server/api/routers/lms/question-bank/_providers";
import { getDomainData } from "@/server/lib/domain";
import { connectToDatabase } from "@workspace/common-logic/lib/db";
import { PublicationStatusEnum } from "@workspace/common-logic/lib/publication_status";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { IQuizHydratedDocument, IQuizQuestionHydratedDocument, QuizModel, QuizQuestionModel } from "@workspace/common-logic/models/lms/quiz.model";
import { IQuizAttemptHydratedDocument, QuizAttemptModel } from "@workspace/common-logic/models/lms/quiz-attempt.model";
import { UserModel } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { MainContextType } from "../api/core/procedures";
import { QuizAttemptStatusEnum } from "@workspace/common-logic/models/lms/quiz-attempt.types";
import { QuestionTypeEnum } from "@workspace/common-logic/models/lms/quiz.types";

// Use types from QuizAttempt model
type AnswerSubmission = Pick<
  IQuizAttemptHydratedDocument["answers"][0],
  "questionId" | "answer"
>;
type ProcessedAnswer = IQuizAttemptHydratedDocument["answers"][0];

interface QuizSubmissionResult {
  success: boolean;
  attemptId: string;
  status: IQuizAttemptHydratedDocument["status"];
  score?: number;
  percentageScore?: number;
  passed?: boolean;
  message: string;
  redirectUrl?: string;
}

// Core functions
async function getActionContext(): Promise<MainContextType> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AuthenticationException("User not authenticated");
  }

  const user = await UserModel.findById(session.user.id);
  if (!user) {
    throw new AuthenticationException("User not found");
  }

  const domainData = await getDomainData();
  if (!domainData.domainObj) {
    throw new NotFoundException("Domain");
  }

  return {
    session,
    user,
    domainData: {
      ...domainData,
      domainObj: domainData.domainObj! as any,
    },
  };
}

// Helper functions
async function validateAttempt(attemptId: string, ctx: MainContextType) {
  const attempt = await QuizAttemptModel.findOne({
    _id: attemptId,
    userId: ctx.user._id,
    orgId: ctx.domainData.domainObj.orgId,
  });

  if (!attempt) {
    throw new NotFoundException("Quiz attempt", attemptId);
  }

  if (attempt.status !== "in_progress") {
    throw new ConflictException("Attempt is not in progress");
  }

  if (attempt.expiresAt && new Date() > attempt.expiresAt) {
    throw new ConflictException("Attempt has expired");
  }

  return attempt;
}

async function validateAnswer(
  answer: any,
  questionId: string,
  questions: IQuizQuestionHydratedDocument[],
): Promise<{ isValid: boolean; normalizedAnswer?: any; error?: string }> {
  const question = questions.find((q) => q._id?.toString() === questionId);
  if (!question) {
    return { isValid: false, error: "Question not found" };
  }

  const provider = QuestionProviderFactory.getProvider(question.type);
  if (!provider) {
    return {
      isValid: false,
      error: `Question type ${question.type} not supported`,
    };
  }

  try {
    const validation = provider.validateAnswer(answer, question as any);
    if (!validation.isValid) {
      return { isValid: false, error: validation.errors.join(", ") };
    }
    return {
      isValid: true,
      normalizedAnswer: validation.normalizedAnswer || answer,
    };
  } catch (error: any) {
    return { isValid: false, error: error.message };
  }
}

async function validateAndProcessAnswers(
  answers: AnswerSubmission[],
  questions: IQuizQuestionHydratedDocument[],
): Promise<{
  isValid: boolean;
  errors: string[];
  processedAnswers: ProcessedAnswer[];
}> {
  const errors: string[] = [];
  const processedAnswers: ProcessedAnswer[] = [];

  if (!Array.isArray(answers) || answers.length === 0) {
    errors.push("At least one answer is required");
    return { isValid: false, errors, processedAnswers: [] };
  }

  for (const answer of answers) {
    if (!answer.questionId || typeof answer.questionId !== "string") {
      errors.push("Question ID is required and must be a string");
      continue;
    }

    if (answer.answer === undefined || answer.answer === null) {
      errors.push("Answer is required");
      continue;
    }

    const question = questions.find(
      (q) => q._id === answer.questionId,
    );
    if (!question) {
      errors.push(`Question ${answer.questionId} not found`);
      continue;
    }

    const provider = QuestionProviderFactory.getProvider(question.type);
    if (!provider) {
      errors.push(`Question type ${question.type} not supported`);
      continue;
    }

    try {
      // Validate answer using provider
      const validation = provider.validateAnswer(
        answer.answer,
        question as any,
      );
      if (!validation.isValid) {
        errors.push(
          `Invalid answer for question ${answer.questionId}: ${validation.errors.join(", ")}`,
        );
        continue;
      }

      const processedAnswer: ProcessedAnswer = {
        questionId: answer.questionId,
        answer: validation.normalizedAnswer || answer.answer,
      };

      processedAnswers.push(processedAnswer);
    } catch (error: any) {
      errors.push(
        `Invalid answer for question ${answer.questionId}: ${error.message}`,
      );
    }
  }

  return { isValid: errors.length === 0, errors, processedAnswers };
}

// Quiz attempt functions
export async function startQuizAttempt(
  quizId: string,
): Promise<QuizSubmissionResult> {
  try {
    const ctx = await getActionContext();

    const quiz = await QuizModel.findOne({
      _id: quizId,
      orgId: ctx.domainData.domainObj.orgId,
      publicationStatus: PublicationStatusEnum.PUBLISHED,
    });

    if (!quiz) {
      throw new NotFoundException("Quiz", quizId);
    }

    const activeAttempt = await QuizAttemptModel.findOne({
      quizId,
      userId: ctx.user._id,
      orgId: ctx.domainData.domainObj.orgId,
      status: QuizAttemptStatusEnum.IN_PROGRESS,
    });

    if (activeAttempt) {
      return {
        success: true,
        attemptId: activeAttempt._id.toString(),
        status: activeAttempt.status,
        message: "Resuming existing attempt",
      };
    }

    if (quiz.maxAttempts && quiz.maxAttempts > 0) {
      const attemptCount = await QuizAttemptModel.countDocuments({
        quizId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
        status: { $in: [QuizAttemptStatusEnum.COMPLETED, QuizAttemptStatusEnum.GRADED] },
      });

      if (attemptCount >= quiz.maxAttempts) {
        throw new ConflictException("Maximum attempts reached for this quiz");
      }
    }

    const attempt = await QuizAttemptModel.create({
      quizId,
      userId: ctx.user._id,
      orgId: ctx.domainData.domainObj.orgId,
      status: QuizAttemptStatusEnum.IN_PROGRESS,
      startedAt: new Date(),
      expiresAt: null,
      // expiresAt: quiz.timeLimit && quiz.timeLimit > 0
      //   ? new Date(Date.now() + quiz.timeLimit * 60 * 1000)
      //   : null,
      answers: [],
    });

    return {
      success: true,
      attemptId: attempt._id.toString(),
      status: attempt.status,
      message: "Quiz attempt started successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      attemptId: "",
      status: QuizAttemptStatusEnum.ABANDONED,
      message: error.message || "Failed to start quiz attempt",
    };
  }
}

export async function getQuizAttempt(attemptId: string) {
  try {
    await connectToDatabase();
    const ctx = await getActionContext();

    const attempt = await QuizAttemptModel.findOne({
      _id: attemptId,
      userId: ctx.user._id,
      orgId: ctx.domainData.domainObj.orgId,
    })
      .populate<{
        quiz: Pick<IQuizHydratedDocument, "_id" | "title" | "totalPoints">;
      }>("quiz", " title totalPoints")
      .lean();

    if (!attempt) {
      throw new NotFoundException("Quiz attempt", attemptId);
    }

    return attempt;
  } catch (error: any) {
    throw new Error(error.message || "Failed to get quiz attempt");
  }
}

export async function getQuizAttemptDetails(attemptId: string) {
  try {
    const ctx = await getActionContext();

    const attempt = await QuizAttemptModel.findOne({
      _id: attemptId,
      userId: ctx.user._id,
      orgId: ctx.domainData.domainObj.orgId,
    }).populate<{
      quiz: {
        quizId: string;
        title: string;
        totalPoints: number;
        passingScore: number;
      };
    }>("quiz", "quizId title totalPoints passingScore");

    if (!attempt) {
      throw new NotFoundException("Quiz attempt", attemptId);
    }

    const quiz = await QuizModel.findById(attempt.quizId);
    if (!quiz) {
      throw new NotFoundException("Quiz", attempt.quizId.toString());
    }

    const questions = await QuizQuestionModel.find({
      _id: { $in: quiz.questionIds },
      orgId: ctx.domainData.domainObj.orgId,
    });

    const questionsData = questions.map((question) => ({
      _id: question._id?.toString(),
      text: question.text,
      type: question.type,
      points: question.points || 1,
      options:
        question.type === QuestionTypeEnum.MULTIPLE_CHOICE
          ? question.options?.map((opt) => ({
            uid: opt.uid,
            text: opt.text,
            isCorrect: opt.isCorrect,
            order: opt.order,
          }))
          : undefined,
      correctAnswers: question.correctAnswers?.map((id) => id.toString()),
    }));

    const answersData = attempt.answers.map((answer) => ({
      questionId: answer.questionId?.toString(),
      userAnswer: answer.answer,
      isCorrect: answer.isCorrect,
      score: answer.score || 0,
      feedback: answer.feedback || "",
      timeSpent: answer.timeSpent || 0,
    }));

    return {
      attemptId: attempt._id.toString(),
      quizTitle: quiz.title,
      totalPoints: quiz.totalPoints,
      passingScore: quiz.passingScore || 60,
      score: attempt.score || 0,
      percentageScore: attempt.percentageScore || 0,
      passed: attempt.passed || false,
      status: attempt.status,
      startedAt: attempt.startedAt?.toISOString(),
      completedAt: attempt.completedAt?.toISOString(),
      questions: questionsData,
      answers: answersData,
    };
  } catch (error: any) {
    throw new Error(error.message || "Failed to get quiz attempt details");
  }
}

export async function saveTeacherFeedback(
  attemptId: string,
  questionId: string,
  feedback: string,
) {
  try {
    const ctx = await getActionContext();

    // Check if user has permission to leave feedback
    const hasPermission = checkPermission(ctx.user.permissions, [
      UIConstants.permissions.manageCourse,
      UIConstants.permissions.manageAnyCourse,
    ]);

    if (!hasPermission) {
      throw new ValidationException(
        "You don't have permission to leave feedback",
      );
    }

    const attempt = await QuizAttemptModel.findOne({
      _id: attemptId,
      orgId: ctx.domainData.domainObj.orgId,
    });

    if (!attempt) {
      throw new NotFoundException("Quiz attempt", attemptId);
    }

    // Find the answer and update its feedback
    const answerIndex = attempt.answers.findIndex(
      (a) => a.questionId?.toString() === questionId,
    );

    if (answerIndex === -1) {
      throw new NotFoundException("Answer not found", questionId);
    }

    if (attempt.answers[answerIndex]) {
      attempt.answers[answerIndex].feedback = feedback;
      attempt.answers[answerIndex].gradedAt = new Date();
      attempt.answers[answerIndex].gradedById = ctx.user._id;
    }

    await attempt.save();

    return {
      success: true,
      message: "Feedback saved successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Failed to save feedback",
    };
  }
}

export async function navigateQuizQuestion(params: {
  attemptId: string;
  currentQuestionId: string;
  currentAnswer: any;
  targetQuestionIndex: number;
  saveAnswer?: boolean;
}) {
  try {
    const ctx = await getActionContext();
    const attempt = await validateAttempt(params.attemptId, ctx);

    const quiz = await QuizModel.findOne({
      _id: attempt.quizId,
      orgId: ctx.domainData.domainObj.orgId,
      publicationStatus: PublicationStatusEnum.PUBLISHED,
    });

    if (!quiz) {
      throw new NotFoundException("Quiz", attempt.quizId);
    }

    const questions = await QuizQuestionModel.find({
      _id: { $in: quiz.questionIds },
      orgId: ctx.domainData.domainObj.orgId,
    });

    if (
      params.targetQuestionIndex < 0 ||
      params.targetQuestionIndex >= questions.length
    ) {
      throw new ValidationException("Invalid question index");
    }

    const targetQuestion = questions[params.targetQuestionIndex];

    if (!targetQuestion) {
      throw new ValidationException("Target question not found");
    }

    if (
      params.saveAnswer &&
      params.currentAnswer !== null &&
      params.currentAnswer !== undefined
    ) {
      const validation = await validateAnswer(
        params.currentAnswer,
        params.currentQuestionId,
        questions,
      );
      if (validation.isValid) {
        // Find existing answer or create new one
        const existingAnswerIndex = attempt.answers.findIndex(
          (a) => a.questionId?.toString() === params.currentQuestionId,
        );

        if (existingAnswerIndex >= 0) {
          const existingAnswer = attempt.answers[existingAnswerIndex];
          if (existingAnswer) {
            existingAnswer.answer = validation.normalizedAnswer;
          }
        } else {
          attempt.answers.push({
            questionId: new mongoose.Types.ObjectId(params.currentQuestionId),
            answer: validation.normalizedAnswer,
            timeSpent: 0,
          });
        }

        await attempt.save();
      }
    }

    // Get target question's current answer from attempt
    const targetQuestionAnswer = attempt.answers.find(
      (a) => a.questionId?.toString() === targetQuestion._id?.toString(),
    )?.answer;
    const targetQuestionInfo = {
      _id: targetQuestion._id?.toString() || "",
      text: targetQuestion.text,
      type: targetQuestion.type,
      points: targetQuestion.points,
      options:
        targetQuestion.type === "multiple_choice"
          ? targetQuestion.options?.map((opt) => ({
            uid: opt.uid,
            text: opt.text,
            order: opt.order,
          }))
          : [],
    };

    const answeredQuestions = attempt.answers
      .filter((a) => a.answer !== null && a.answer !== undefined)
      .map((a) => a.questionId?.toString())
      .filter(Boolean) as string[];

    return {
      success: true,
      message: "Navigation successful",
      targetQuestionAnswer,
      targetQuestionInfo,
      answeredQuestions,
    };
  } catch (error: any) {
    if (
      error instanceof ValidationException ||
      error instanceof ConflictException ||
      error instanceof NotFoundException
    ) {
      return {
        success: false,
        message: error.message,
      };
    }

    console.error("Navigation error:", error);
    return {
      success: false,
      message: "An unexpected error occurred during navigation",
    };
  }
}
export async function submitQuizAttempt(attemptId: string) {
  try {
    const ctx = await getActionContext();
    const attempt = await validateAttempt(attemptId, ctx);

    const quiz = await QuizModel.findById(attempt.quizId);
    if (!quiz) {
      throw new NotFoundException("Quiz", attempt.quizId.toString());
    }

    const questions = await QuizQuestionModel.find({
      _id: { $in: quiz.questionIds },
      orgId: ctx.domainData.domainObj.orgId,
    });

    let totalScore = 0;
    const gradedAnswers = attempt.answers.map((answer) => {
      const question = questions.find(
        (q) => q._id?.toString() === answer.questionId?.toString(),
      );

      if (!question) {
        return {
          ...answer,
          isCorrect: false,
          score: 0,
          feedback: "Question not found",
        };
      }

      const provider = QuestionProviderFactory.getProvider(question.type);
      if (!provider) {
        return {
          ...answer,
          isCorrect: false,
          score: 0,
          feedback: "Question type not supported",
        };
      }

      const questionScore = provider.calculateScore(
        answer.answer,
        question as any,
      );
      const isCorrect = questionScore > 0;
      totalScore += questionScore;

      return {
        ...answer,
        isCorrect,
        score: questionScore,
        feedback: isCorrect ? "Correct!" : "Incorrect",
      };
    });
    // Calculate percentage and pass/fail
    const totalPossiblePoints = questions.reduce(
      (sum, q) => sum + (q.points || 1),
      0,
    );
    const percentageScore =
      totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
    const passed = percentageScore >= (quiz.passingScore || 60);

    // Update attempt with final results
    const updatedAttempt = await QuizAttemptModel.findById(attemptId);
    if (!updatedAttempt) {
      throw new NotFoundException("Quiz attempt", attemptId);
    }

    updatedAttempt.status = QuizAttemptStatusEnum.COMPLETED;
    updatedAttempt.completedAt = new Date();
    updatedAttempt.answers = gradedAnswers;
    updatedAttempt.score = totalScore;
    updatedAttempt.percentageScore = percentageScore;
    updatedAttempt.passed = passed;

    await updatedAttempt.save();
    return {
      success: true,
      attemptId: updatedAttempt._id.toString(),
      status: updatedAttempt.status,
      score: updatedAttempt.score,
      percentageScore: updatedAttempt.percentageScore,
      passed: updatedAttempt.passed,
      message: "Quiz completed and graded successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      attemptId: attemptId,
      status: QuizAttemptStatusEnum.ABANDONED,
      message: error.message || "Failed to submit quiz attempt",
    };
  }
}

export async function getQuizQuestions(quizId: string): Promise<{
  _id: string;
  title: string;
  description?: string;
  questions: Partial<IQuizQuestionHydratedDocument>[];
}> {
  try {
    const ctx = await getActionContext();

    const quiz = await QuizModel.findOne({
      _id: quizId,
      orgId: ctx.domainData.domainObj.orgId,
      publicationStatus: PublicationStatusEnum.PUBLISHED,
    });

    if (!quiz) {
      throw new NotFoundException("Quiz", quizId);
    }

    const questions = await QuizQuestionModel.find({
      _id: { $in: quiz.questionIds },
      orgId: ctx.domainData.domainObj.orgId,
    });

    const processedQuestions = questions.map((question) => {
      const provider = QuestionProviderFactory.getProvider(question.type);
      if (
        provider &&
        typeof provider.processQuestionForDisplay === "function"
      ) {
        return provider.processQuestionForDisplay(question as any, true);
      }

      // Convert to plain object and remove sensitive fields
      const processed = { ...question };
      delete (processed as any).correctAnswers;
      delete (processed as any).explanation;
      if ((processed as any).options) {
        (processed as any).options = (processed as any).options.map(
          (opt: any) => {
            const { isCorrect, ...rest } = opt;
            // Ensure uid is preserved for multiple choice questions
            return rest;
          },
        );
      }
      return processed;
    });

    return {
      _id: quiz._id.toString(),
      title: quiz.title || "Quiz",
      description: quiz.description,
      questions: processedQuestions,
    };
  } catch (error: any) {
    throw new Error(error.message || "Failed to get quiz questions");
  }
}
export async function regradeQuizAttempt(attemptId: string) {
  try {
    const ctx = await getActionContext();

    // Check if user has permission to regrade
    const hasPermission = checkPermission(ctx.user.permissions, [
      UIConstants.permissions.manageCourse,
      UIConstants.permissions.manageAnyCourse,
    ]);

    if (!hasPermission) {
      throw new ValidationException(
        "You don't have permission to regrade attempts",
      );
    }

    const attempt = await QuizAttemptModel.findOne({
      _id: attemptId,
      orgId: ctx.domainData.domainObj.orgId,
    });

    if (!attempt) {
      throw new NotFoundException("Quiz attempt", attemptId);
    }

    const quiz = await QuizModel.findById(attempt.quizId);
    if (!quiz) {
      throw new NotFoundException("Quiz", attempt.quizId.toString());
    }

    const questions = await QuizQuestionModel.find({
      _id: { $in: quiz.questionIds },
      orgId: ctx.domainData.domainObj.orgId,
    });

    // Reuse the same grading logic from submitQuizAttempt
    let totalScore = 0;
    const gradedAnswers = attempt.answers.map((answer) => {
      const question = questions.find(
        (q) => q._id === answer.questionId,
      );

      if (!question) {
        return {
          ...answer,
          isCorrect: false,
          score: 0,
          feedback: "Question not found",
        };
      }

      const provider = QuestionProviderFactory.getProvider(question.type);
      if (!provider) {
        return {
          ...answer,
          isCorrect: false,
          score: 0,
          feedback: "Question type not supported",
        };
      }

      const questionScore = provider.calculateScore(
        answer.answer,
        question as any,
      );
      const isCorrect = questionScore > 0;
      totalScore += questionScore;

      return {
        ...answer,
        isCorrect,
        score: questionScore,
        feedback: isCorrect ? "Correct!" : "Incorrect",
      };
    });

    // Calculate percentage and pass/fail
    const totalPossiblePoints = questions.reduce(
      (sum, q) => sum + (q.points || 1),
      0,
    );
    const percentageScore =
      totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
    const passed = percentageScore >= (quiz.passingScore || 60);

    // Update attempt with new results
    const updatedAttempt = await QuizAttemptModel.findById(attemptId);
    if (!updatedAttempt) {
      throw new NotFoundException("Quiz attempt", attemptId);
    }

    updatedAttempt.status = QuizAttemptStatusEnum.GRADED;
    updatedAttempt.answers = gradedAnswers;
    updatedAttempt.score = totalScore;
    updatedAttempt.percentageScore = percentageScore;
    updatedAttempt.passed = passed;
    updatedAttempt.gradedAt = new Date();

    await updatedAttempt.save();

    return {
      success: true,
      attemptId: updatedAttempt._id.toString(),
      status: updatedAttempt.status,
      score: updatedAttempt.score,
      percentageScore: updatedAttempt.percentageScore,
      passed: updatedAttempt.passed,
      message: "Quiz attempt regraded successfully",
    };
  } catch (error: any) {
    return {
      success: false,
      attemptId: attemptId,
      status: "error",
      message: error.message || "Failed to regrade quiz attempt",
    };
  }
}

export async function getAttemptStatistics(quizId: string): Promise<{
  totalAttempts: number;
  completedAttempts: number;
  bestScore: number;
  averageScore: number;
  lastAttempt: IQuizAttemptHydratedDocument | null;
}> {
  try {
    const ctx = await getActionContext();

    const attempts = await QuizAttemptModel.find({
      quizId,
      userId: ctx.user._id,
      orgId: ctx.domainData.domainObj.orgId,
    });

    const completedAttempts = attempts.filter(
      (a) => a.status === QuizAttemptStatusEnum.COMPLETED || a.status === QuizAttemptStatusEnum.GRADED,
    );
    const bestScore =
      completedAttempts.length > 0
        ? Math.max(...completedAttempts.map((a) => a.percentageScore || 0))
        : 0;

    const averageScore =
      completedAttempts.length > 0
        ? completedAttempts.reduce(
          (sum, a) => sum + (a.percentageScore || 0),
          0,
        ) / completedAttempts.length
        : 0;

    return {
      totalAttempts: attempts.length,
      completedAttempts: completedAttempts.length,
      bestScore,
      averageScore: Math.round(averageScore * 100) / 100,
      lastAttempt: attempts.length > 0 ? (attempts[0] as any) : null,
    };
  } catch (error: any) {
    throw new Error(error.message || "Failed to get attempt statistics");
  }
}
export async function getUserQuizAttempts(
  quizId: string,
): Promise<IQuizAttemptHydratedDocument[]> {
  try {
    const ctx = await getActionContext();

    const attempts = await QuizAttemptModel.find({
      quizId,
      userId: ctx.user._id,
      orgId: ctx.domainData.domainObj.orgId,
    }).sort({ createdAt: -1 });

    return attempts;
  } catch (error: any) {
    throw new Error(error.message || "Failed to get quiz attempts");
  }
}
