import {
  NotFoundException,
  ValidationException,
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  MainContextType,
  protectedProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { PublicationStatusEnum } from "@workspace/common-logic/lib/publication_status";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { QuizModel, QuizQuestionModel } from "@workspace/common-logic/models/lms/quiz.model";
import { IQuizQuestion, QuestionTypeEnum } from "@workspace/common-logic/models/lms/quiz.types";
import mongoose, { RootFilterQuery } from "mongoose";
import { z } from "zod";
import { QuestionProviderFactory } from "../question-bank/_providers";

const findOrAssertQuiz = async (quizId: string, ctx: MainContextType) => {
  const quiz = await QuizModel.findOne({
    _id: quizId,
    orgId: ctx.domainData.domainObj.orgId,
  });
  if (!quiz) throw new NotFoundException("Quiz", quizId);
  return quiz;
};

const getQuestionProvider = (questionType: IQuizQuestion["type"]) => {
  const provider = QuestionProviderFactory.getProvider(questionType);
  if (!provider) {
    throw new ValidationException(`Unsupported question type: ${questionType}`);
  }
  return provider;
};


export const quizQuestionsRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      ListInputSchema.extend({
        filter: z.object({
          quizId: documentIdValidator(),
          type: z.nativeEnum(QuestionTypeEnum).optional(),
        }),
      }),
    )
    .query(async ({ ctx, input }) => {
      const quiz = await findOrAssertQuiz(input.filter.quizId, ctx as any);
      const query: RootFilterQuery<typeof QuizQuestionModel> = {
        orgId: ctx.domainData.domainObj.orgId,
        _id: { $in: quiz.questionIds },
        ...(input.filter?.type ? { type: input.filter.type } : {}),
      };
      const paginationMeta = paginate(input.pagination);
      const [items, total] = await Promise.all([
        QuizQuestionModel.find(query)
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(
            input.orderBy
              ? {
                [input.orderBy.field]:
                  input.orderBy.direction === "asc" ? 1 : -1,
              }
              : { createdAt: -1 },
          )
          .lean(),
        paginationMeta.includePaginationCount ? QuizQuestionModel.countDocuments(query) : Promise.resolve(0),
      ]);
      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  publicListQuestions: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      ListInputSchema.extend({
        filter: z.object({
          quizId: documentIdValidator(),
          type: z.nativeEnum(QuestionTypeEnum).optional(),
        }),
      }),
    )
    .query(async ({ ctx, input }) => {
      const quiz = await QuizModel.findOne({
        _id: input.filter.quizId,
        orgId: ctx.domainData.domainObj.orgId,
        publicationStatus: PublicationStatusEnum.PUBLISHED,
      });
      if (!quiz) throw new NotFoundException("Quiz not found");

      const query: RootFilterQuery<typeof QuizQuestionModel> = {
        orgId: ctx.domainData.domainObj.orgId,
        _id: { $in: quiz.questionIds },
        ...(input.filter?.type ? { type: input.filter.type } : {}),
      };
      const paginationMeta2 = paginate(input.pagination);
      const [items, total] = await Promise.all([
        QuizQuestionModel.find(query)
          .skip(paginationMeta2.skip)
          .limit(paginationMeta2.take)
          .sort(
            input.orderBy
              ? {
                [input.orderBy.field]:
                  input.orderBy.direction === "asc" ? 1 : -1,
              }
              : { createdAt: -1 },
          )
          .lean(),
        paginationMeta2.includePaginationCount ? QuizQuestionModel.countDocuments(query) : Promise.resolve(0),
      ]);
      return jsonify({
        items,
        total,
        meta: paginationMeta2,
      });
    }),

  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      getFormDataSchema({
        text: z.string().min(1),
        type: z.nativeEnum(QuestionTypeEnum),
        points: z.number().min(0),
        explanation: z.string().optional(),
        options: z
          .array(
            z.object({
              uid: z.string(),
              text: z.string(),
              isCorrect: z.boolean(),
            }),
          )
          .optional(),
        correctAnswers: z.array(z.string()).optional(),
      }).extend({
        quizId: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const quiz = await findOrAssertQuiz(input.quizId, ctx as any);
      const question = await QuizQuestionModel.create({
        ...input.data,
        orgId: ctx.domainData.domainObj.orgId,
        teacherId: ctx.user._id,
      });
      const newQuestionIds = Array.from(
        new Set([...quiz.questionIds, question._id]),
      );
      await QuizModel.findByIdAndUpdate(input.quizId, {
        questionIds: newQuestionIds,
        totalPoints: quiz.totalPoints + input.data.points,
      });
      return question;
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      z.object({
        id: documentIdValidator(),
        quizId: documentIdValidator(),
        data: z.any(), // Let the provider handle validation
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const quiz = await findOrAssertQuiz(input.quizId, ctx as any);
      if (!quiz.questionIds.includes(new mongoose.Types.ObjectId(input.id)))
        throw new NotFoundException("Question not found");

      const question = await QuizQuestionModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!question) throw new NotFoundException("Question not found");

      const provider = getQuestionProvider(question.type);
      const validatedData = provider.getValidatedUpdateData(
        question as any,
        input.data as any,
      );

      const oldPoints = question.points || 0;
      const newPoints = validatedData.points || oldPoints;
      const pointsDifference = newPoints - oldPoints;

      // Update question with validated data
      await QuizQuestionModel.findByIdAndUpdate(input.id, validatedData, {
        new: true,
      });

      // Update quiz total points if points changed
      if (pointsDifference !== 0) {
        await QuizModel.findByIdAndUpdate(input.quizId, {
          $inc: { totalPoints: pointsDifference },
        });
      }

      const updated = await QuizQuestionModel.findById(input.id);
      return updated;
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      z.object({
        id: documentIdValidator(),
        quizId: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const quiz = await findOrAssertQuiz(input.quizId, ctx as any);
      if (!quiz.questionIds.includes(new mongoose.Types.ObjectId(input.id)))
        throw new NotFoundException("Question not found");

      const question = await QuizQuestionModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!question) throw new NotFoundException("Question not found");

      await QuizModel.findByIdAndUpdate(input.quizId, {
        $pull: { questionIds: question._id },
        $inc: { totalPoints: -(question.points || 0) },
      });
      await QuizQuestionModel.findByIdAndDelete(input.id);
      return { success: true };
    }),

  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      z.object({
        id: documentIdValidator(),
        quizId: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const quiz = await findOrAssertQuiz(input.quizId, ctx as any);
      if (!quiz.questionIds.includes(new mongoose.Types.ObjectId(input.id)))
        throw new NotFoundException("Question not found");

      const question = await QuizQuestionModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!question) throw new NotFoundException("Question not found");
      return question;
    }),
});
