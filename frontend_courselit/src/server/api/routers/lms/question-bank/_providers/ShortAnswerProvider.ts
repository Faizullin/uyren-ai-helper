import { BaseQuestionProvider, QuestionAnswer } from "./BaseQuestionProvider";
import {
  ShortAnswerQuestion,
  QuestionTypeEnum,
} from "@workspace/common-logic/models/lms/quiz.types";
import { MainContextType } from "@/server/api/core/procedures";
import { z } from "zod";

const shortAnswerSchema = z.object({
  correctAnswers: z
    .array(z.string().min(1, "Answer cannot be empty"))
    .min(1, "Correct answer is required")
    .optional(),
  settings: z.object({}).optional(),
});

export class ShortAnswerProvider extends BaseQuestionProvider<ShortAnswerQuestion> {
  readonly type = QuestionTypeEnum.SHORT_ANSWER;
  readonly displayName = "Short Answer";
  readonly description = "Text-based answer with flexible matching";

  protected getSpecificValidationSchema(): z.ZodObject<z.ZodRawShape> {
    return shortAnswerSchema;
  }

  protected validateAnswerSpecific(
    answer: QuestionAnswer,
    question: ShortAnswerQuestion,
  ): string[] {
    const errors: string[] = [];

    if (!Array.isArray(answer)) {
      errors.push("Answer must be an array of strings");
      return errors;
    }

    if (answer.length === 0) {
      errors.push("Answer cannot be empty");
      return errors;
    }

    answer.forEach((ans, index) => {
      if (typeof ans !== "string") {
        errors.push(`Answer ${index + 1} must be a string`);
        return;
      }

      if (!ans || ans.trim().length === 0) {
        errors.push(`Answer ${index + 1} cannot be empty`);
        return;
      }

      const minLength = question.settings?.minAnswerLength || 1;
      const maxLength = question.settings?.maxAnswerLength || 500;

      if (ans.length < minLength) {
        errors.push(
          `Answer ${index + 1} must be at least ${minLength} characters long`,
        );
      }

      if (ans.length > maxLength) {
        errors.push(
          `Answer ${index + 1} must be no more than ${maxLength} characters long`,
        );
      }
    });

    return errors;
  }

  protected normalizeAnswer(
    answer: QuestionAnswer,
    _question: ShortAnswerQuestion,
  ) {
    return answer;
  }

  isAnswerCorrect(
    answer: QuestionAnswer,
    question: ShortAnswerQuestion,
  ): boolean {
    if (
      !Array.isArray(answer) ||
      answer.length === 0 ||
      !question.correctAnswers
    )
      return false;

    const caseSensitive = question.settings?.caseSensitive ?? false;

    const value = answer.some((ans) => {
      const answerStr = ans.trim();

      return question.correctAnswers!.some((correct: string) => {
        const correctStr = correct.trim();

        if (caseSensitive) {
          return answerStr === correctStr;
        } else {
          const answerLower = answerStr.toLowerCase();
          const correctLower = correctStr.toLowerCase();
          return answerLower === correctLower;
        }
      });
    });
    return value;
  }

  getDefaultSettings(): Record<string, unknown> {
    return {
      ...super.getDefaultSettings(),
      // shuffleOptions: false, // Short answer doesn't have options to shuffle
      // caseSensitive: false,
      // partialMatch: true,
      // minAnswerLength: 1,
      // maxAnswerLength: 500
    };
  }

  // Override to add short answer specific validation
  getValidatedData(
    questionData: Partial<ShortAnswerQuestion>,
    ctx: MainContextType,
  ): Partial<ShortAnswerQuestion> {
    // Ensure correct answers are properly formatted
    if (questionData.correctAnswers) {
      questionData.correctAnswers = questionData.correctAnswers
        .filter((answer: unknown) => answer && String(answer).trim().length > 0)
        .map((answer: unknown) => String(answer).trim());
    }

    return super.getValidatedData(questionData, ctx);
  }

  // Process short answer for display
  processQuestionForDisplay(
    question: ShortAnswerQuestion,
    hideAnswers: boolean = true,
  ): Partial<ShortAnswerQuestion> {
    const processed = super.processQuestionForDisplay(question, hideAnswers);

    if (hideAnswers) {
      delete (processed as Record<string, unknown>).correctAnswers;
      delete (processed as Record<string, unknown>).explanation;
    }

    return processed;
  }
}
