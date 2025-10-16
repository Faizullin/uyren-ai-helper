import {
  AuthorizationException,
  NotFoundException
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  protectedProcedure
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { PublicationStatusEnum } from "@workspace/common-logic/lib/publication_status";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { ICourseHydratedDocument } from "@workspace/common-logic/models/lms/course.model";
import { IQuizQuestionHydratedDocument, QuizModel, QuizQuestionModel } from "@workspace/common-logic/models/lms/quiz.model";
import { QuestionTypeEnum } from "@workspace/common-logic/models/lms/quiz.types";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";

const CreateSchema = getFormDataSchema({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  courseId: documentIdValidator(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  dueDate: z.date().optional(),
  timeLimit: z.number().min(1).optional(),
  maxAttempts: z.number().min(1).max(10).default(1),
  passingScore: z.number().min(0).max(100).default(60),
  shuffleQuestions: z.boolean().default(true),
  showResults: z.boolean().default(false),
  publicationStatus: z.nativeEnum(PublicationStatusEnum).optional().default(PublicationStatusEnum.DRAFT),
  totalPoints: z.number().min(1).default(0),
});

export const quizRouter = router({
  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(CreateSchema)
    .mutation(async ({ ctx, input }) => {
      const quiz = await QuizModel.create({
        ...input.data,
        ownerId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      return jsonify(quiz.toObject());
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      getFormDataSchema({
        title: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        courseId: documentIdValidator().optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
        dueDate: z.date().optional(),
        timeLimit: z.number().min(1).optional(),
        maxAttempts: z.number().min(1).max(10).optional(),
        passingScore: z.number().min(0).max(100).optional(),
        shuffleQuestions: z.boolean().optional(),
        showResults: z.boolean().optional(),
        publicationStatus: z.nativeEnum(PublicationStatusEnum).optional(),
        totalPoints: z.number().min(1).optional(),
      }, {
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const quiz = await QuizModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!quiz) throw new NotFoundException("Quiz", input.id);
      Object.keys(input.data).forEach((key) => {
        (quiz as any)[key] = (input.data as any)[key];
      });
      const saved = await quiz.save();
      return jsonify(saved.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(z.object({
      id: documentIdValidator(),
    }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await QuizModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!quiz) throw new NotFoundException("Quiz", input.id);
      await QuizModel.findByIdAndDelete(input.id);
      return { success: true };
    }),

  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const quiz = await QuizModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          owner: Pick<IUserHydratedDocument, "username" | "fullName" | "email">;
        }>("owner", "username fullName email")
        .populate<{
          course: Pick<ICourseHydratedDocument, "_id" | "title">;
        }>("course", "title")
        .lean();

      if (!quiz) throw new NotFoundException("Quiz", input.id);
      const hasAccess = checkPermission(ctx.user.permissions, [
        UIConstants.permissions.manageAnyCourse,
      ]);
      if (!hasAccess && quiz.publicationStatus === PublicationStatusEnum.DRAFT)
        throw new AuthorizationException();
      return jsonify(quiz);
    }),

  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            publicationStatus: z.nativeEnum(PublicationStatusEnum).optional(),
            courseId: documentIdValidator().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof QuizModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };
      if (input.filter?.publicationStatus) query.publicationStatus = input.filter.publicationStatus;
      if (input.filter?.courseId) query.courseId = input.filter.courseId;
      const paginationMeta = paginate(input.pagination);
      const orderBy = input.orderBy || {
        field: "createdAt",
        direction: "desc",
      };
      const sortObject: Record<string, 1 | -1> = {
        [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
      };
      const [items, total] = await Promise.all([
        QuizModel.find(query)
          .populate("owner", "name email")
          .populate("course", "title")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? QuizModel.countDocuments(query)
          : Promise.resolve(null),
      ]);
      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  archive: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(z.object({
      id: documentIdValidator(),
    }))
    .mutation(async ({ ctx, input }) => {
      const quiz = await QuizModel.findOne({
        orgId: ctx.domainData.domainObj.orgId,
        _id: input.id,
      });
      if (!quiz) throw new NotFoundException("Quiz", input.id);

      quiz.publicationStatus = PublicationStatusEnum.ARCHIVED;
      const saved = await quiz.save();

      return jsonify(saved.toObject());
    }),

  protectedGetById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const quiz = await QuizModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
        ...(checkPermission(ctx.user.permissions, [UIConstants.permissions.manageAnyCourse]) ? {} : { publicationStatus: PublicationStatusEnum.PUBLISHED }),
      })
        .populate<{
          owner: Pick<IUserHydratedDocument, "username" | "fullName" | "email">;
        }>("owner", "username fullName email")
        .populate<{
          course: Pick<ICourseHydratedDocument, "title">;
        }>("course", "title")
        .lean();
      if (!quiz) throw new NotFoundException("Quiz", input.id);
      return jsonify(quiz);
    }),

  protectedGetByIdWithQuestions: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const quiz = await QuizModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
        publicationStatus: PublicationStatusEnum.PUBLISHED,
      })
        .populate<{
          owner: Pick<IUserHydratedDocument, "username" | "fullName" | "email">;
        }>("owner", "username fullName email")
        .populate<{
          course: Pick<ICourseHydratedDocument, "title">;
        }>("course", "title").lean();

      if (!quiz) throw new NotFoundException("Quiz", input.id);

      const questions = await QuizQuestionModel.find({
        _id: { $in: quiz.questionIds },
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      const processedQuestions = questions.map((question) => {
        const processed: Pick<IQuizQuestionHydratedDocument, "_id" | "text" | "type" | "points" | "explanation" | "options"> = {
          _id: question._id,
          text: question.text,
          type: question.type,
          points: question.points,
          explanation: question.explanation,
          options: (question as any).options,
        }
        if (processed.type === QuestionTypeEnum.MULTIPLE_CHOICE) {
          if (processed.options) {
            processed.options = processed.options.map((opt) => {
              const { isCorrect, ...rest } = opt;
              return rest as any;
            });
          }
        }
        return processed;
      });

      return jsonify({
        ...quiz,
        questions: processedQuestions,
      });
    }),
});
