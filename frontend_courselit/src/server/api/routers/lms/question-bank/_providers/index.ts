import {
  IQuizQuestion,
  QuestionTypeEnum,
} from "@workspace/common-logic/models/lms/quiz.types";
import { QuestionAnswer } from "./BaseQuestionProvider";
import { MultipleChoiceProvider } from "./MultipleChoiceProvider";
import { ShortAnswerProvider } from "./ShortAnswerProvider";

export class QuestionProviderFactory {
  private static providers = {
    [QuestionTypeEnum.MULTIPLE_CHOICE]: new MultipleChoiceProvider(),
    [QuestionTypeEnum.SHORT_ANSWER]: new ShortAnswerProvider(),
  };

  static getProvider(type: QuestionTypeEnum) {
    return this.providers[type];
  }

  static validateQuestion(question: Partial<IQuizQuestion>): {
    isValid: boolean;
    errors: string[];
  } {
    if (!question.type) {
      return {
        isValid: false,
        errors: ["Question type is required"],
      };
    }

    const provider = this.getProvider(question.type);
    if (!provider) {
      return {
        isValid: false,
        errors: [`Unsupported question type: ${question.type}`],
      };
    }
    return provider.validateQuestion(question as any);
  }

  static calculateScore(
    type: QuestionTypeEnum,
    answer: QuestionAnswer,
    question: IQuizQuestion,
  ): number {
    const provider = this.getProvider(type);
    if (!provider) return 0;

    return provider.calculateScore(answer, question as any);
  }

  static processQuestionForDisplay(
    type: QuestionTypeEnum,
    question: IQuizQuestion,
    hideAnswers: boolean = true,
  ): Partial<IQuizQuestion> {
    const provider = this.getProvider(type);
    if (!provider) return question;

    return provider.processQuestionForDisplay(question as any, hideAnswers);
  }

  static getDefaultSettings(
    type: QuestionTypeEnum,
  ): Record<string, unknown> {
    const provider = this.getProvider(type);
    if (!provider) return {};

    return provider.getDefaultSettings();
  }

  static getQuestionMetadata(
    type: QuestionTypeEnum,
  ): { type: string; displayName: string; description: string } | null {
    const provider = this.getProvider(type);
    if (!provider) return null;

    return {
      type: provider.type,
      displayName: provider.displayName,
      description: provider.description,
    };
  }
}
