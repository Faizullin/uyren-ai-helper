import { MainContextType } from "@/server/api/core/procedures";
import {
  IQuizQuestion,
  QuestionTypeEnum,
} from "@workspace/common-logic/models/lms/quiz.types";
import { z } from "zod";

export const baseQuestionSchema = z.object({
  text: z.string().min(1, "Question text is required").max(2000),
  points: z.number().min(1, "Points must be at least 1").max(100),
  explanation: z.string().max(2000).optional(),
});

export type QuestionAnswer = string[];

export interface AnswerValidationResult {
  isValid: boolean;
  errors: string[];
  normalizedAnswer?: QuestionAnswer;
}

export interface AnswerScoringResult {
  isCorrect: boolean;
  score: number;
  feedback: string;
  partialCredit?: number;
}

export abstract class BaseQuestionProvider<T extends IQuizQuestion = IQuizQuestion> {
  abstract readonly type: QuestionTypeEnum;
  abstract readonly description: string;
  abstract readonly displayName: string;

  protected abstract getSpecificValidationSchema(): z.ZodObject<z.ZodRawShape>;

  protected abstract validateAnswerSpecific(
    answer: QuestionAnswer,
    question: T,
  ): string[];

  protected abstract normalizeAnswer(answer: QuestionAnswer, question: T): QuestionAnswer;

  abstract isAnswerCorrect(answer: QuestionAnswer, question: T): boolean;

  validateQuestion(question: Partial<T>): {
    isValid: boolean;
    errors: string[];
  } {
    try {
      const baseSchema = baseQuestionSchema.partial();
      const specificSchema = this.getSpecificValidationSchema();
      const fullSchema = baseSchema.merge(specificSchema);

      fullSchema.parse(question);
      return { isValid: true, errors: [] };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          isValid: false,
          errors: error.errors.map((e) => e.message),
        };
      }
      return {
        isValid: false,
        errors: ["Validation failed"],
      };
    }
  }

  validateAnswer(answer: QuestionAnswer, question: T): AnswerValidationResult {
    const errors: string[] = [];

    if (answer === undefined || answer === null) {
      errors.push("Answer is required");
      return { isValid: false, errors };
    }

    const specificErrors = this.validateAnswerSpecific(answer, question);
    errors.push(...specificErrors);

    return {
      isValid: errors.length === 0,
      errors,
      normalizedAnswer:
        errors.length === 0
          ? this.normalizeAnswer(answer, question)
          : undefined,
    };
  }

  getValidatedData(questionData: Partial<T>, ctx: MainContextType): Partial<T> {
    try {
      const baseSchema = baseQuestionSchema.partial();
      const specificSchema = this.getSpecificValidationSchema();
      const fullSchema = baseSchema.merge(specificSchema);

      const validatedData = fullSchema.parse(questionData);
      const defaultSettings = this.getDefaultSettings();

      return {
        ...defaultSettings,
        ...validatedData,
      } as Partial<T>;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Validation failed: ${error.errors.map((e) => e.message).join(", ")}`,
        );
      }
      throw new Error("Validation failed");
    }
  }

  getValidatedUpdateData(existingQuestion: T, updateData: Partial<T>): Partial<T> {
    try {
      const baseSchema = baseQuestionSchema.partial();
      const specificSchema = this.getSpecificValidationSchema();
      const fullSchema = baseSchema.merge(specificSchema.partial());

      const mergedData = { ...existingQuestion, ...updateData };
      const validatedData = fullSchema.parse(mergedData);

      return validatedData as Partial<T>;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(
          `Validation failed: ${error.errors.map((e) => e.message).join(", ")}`,
        );
      }
      throw new Error("Validation failed");
    }
  }

  calculateScore(answer: QuestionAnswer, question: T): number {
    if (!answer || !question) return 0;

    const isCorrect = this.isAnswerCorrect(answer, question);
    return isCorrect ? question.points : 0;
  }

  getScoringResult(answer: QuestionAnswer, question: T): AnswerScoringResult {
    const isCorrect = this.isAnswerCorrect(answer, question);
    const score = this.calculateScore(answer, question);

    return {
      isCorrect,
      score,
      feedback: isCorrect ? "Correct!" : "Incorrect",
    };
  }

  processQuestionForDisplay(question: T, hideAnswers: boolean = true): Partial<T> {
    const processed = { ...question };

    if (hideAnswers) {
      delete processed.correctAnswers;
      delete processed.explanation;
    }

    return processed;
  }

  getDefaultSettings(): Record<string, unknown> {
    return {
      points: 1,
      shuffleOptions: true,
    };
  }
}
