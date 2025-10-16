import { BaseQuestionProvider, QuestionAnswer } from "./BaseQuestionProvider";
import {
  MultipleChoiceQuestion,
  QuestionTypeEnum,
} from "@workspace/common-logic/models/lms/quiz.types";
import { MainContextType } from "@/server/api/core/procedures";
import { z } from "zod";

const multipleChoiceSchema = z.object({
  options: z
    .array(
      z.object({
        uid: z.string().min(1, "Option UID is required"),
        text: z.string().min(1, "Option text is required"),
        isCorrect: z.boolean(),
        order: z.number().optional(),
      }),
    )
    .min(2, "Multiple choice questions must have at least 2 options"),
  correctAnswers: z
    .array(z.string())
    .min(1, "Correct answer is required")
    .optional(),
  settings: z.object({}).optional(),
});

export class MultipleChoiceProvider extends BaseQuestionProvider<MultipleChoiceQuestion> {
  readonly type = QuestionTypeEnum.MULTIPLE_CHOICE;
  readonly displayName = "Multiple Choice";
  readonly description = "Single or multiple correct answers from options";

  protected getSpecificValidationSchema(): z.ZodObject<z.ZodRawShape> {
    return multipleChoiceSchema;
  }

  protected validateAnswerSpecific(
    answer: QuestionAnswer,
    question: MultipleChoiceQuestion,
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
      }
    });
    return errors;
  }

  protected normalizeAnswer(
    answer: QuestionAnswer,
    _question: MultipleChoiceQuestion,
  ) {
    return answer;
  }

  isAnswerCorrect(
    answer: QuestionAnswer,
    question: MultipleChoiceQuestion,
  ): boolean {
    if (
      !Array.isArray(answer) ||
      answer.length === 0 ||
      !question.correctAnswers
    )
      return false;

    const correctAnswers = question.correctAnswers;

    // Sort both arrays for comparison
    const sortedA = [...answer].sort();
    const sortedB = [...correctAnswers].sort();

    return (
      sortedA.length === sortedB.length &&
      sortedA.every((v, i) => v === sortedB[i])
    );
  }

  getDefaultSettings(): Record<string, unknown> {
    return {
      ...super.getDefaultSettings(),
      // shuffleOptions: true,
      // allowMultipleAnswers: false,
      // minOptions: 2,
      // maxOptions: 6
    };
  }

  // Override to add multiple choice specific validation
  getValidatedData(
    questionData: Partial<MultipleChoiceQuestion>,
    ctx: MainContextType,
  ): Partial<MultipleChoiceQuestion> {
    // Ensure options are properly formatted
    if (questionData.options) {
      questionData.options = questionData.options
        .filter((opt) => opt.text && opt.text.trim().length > 0)
        .map((opt) => ({
          uid: opt.uid || `uid-${Date.now()}-${Math.random()}`,
          text: opt.text.trim(),
          isCorrect: Boolean(opt.isCorrect),
          order: opt.order || 0,
        }));
    }

    // Extract correct answers from options if not provided
    if (!questionData.correctAnswers && questionData.options) {
      questionData.correctAnswers = questionData.options
        .filter((opt) => opt.isCorrect)
        .map((opt) => opt.uid);
    }

    return super.getValidatedData(questionData, ctx);
  }

  // Hide correctness flags for students
  processQuestionForDisplay(
    question: MultipleChoiceQuestion,
    hideAnswers: boolean = true,
  ): Partial<MultipleChoiceQuestion> {
    const processed = super.processQuestionForDisplay(question, hideAnswers);

    // if (hideAnswers && processed.options) {
    //   processed.options = processed.options.map((opt) => {
    //     const { isCorrect, ...rest } = opt;
    //     return rest as { _id?: string; uid: string; text: string; order?: number };
    //   });
    // }

    return processed;
  }
}
