import { regradeQuizAttempt } from "@/server/actions/quiz-attempt";
import {
  AuthorizationException,
  NotFoundException,
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  protectedProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { QuizAttemptModel } from "@workspace/common-logic/models/lms/quiz-attempt.model";
import { QuizAttemptStatusEnum } from "@workspace/common-logic/models/lms/quiz-attempt.types";
import { IQuizHydratedDocument } from "@workspace/common-logic/models/lms/quiz.model";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";


const CreateQuizAttemptSchema = getFormDataSchema({
  quizId: documentIdValidator(),
  status: z.nativeEnum(QuizAttemptStatusEnum).default(QuizAttemptStatusEnum.IN_PROGRESS),
  startedAt: z.date().optional(),
  expiresAt: z.date().optional(),
});

const QuizAttemptListInputSchema = ListInputSchema.extend({
  filter: z
    .object({
      quizId: documentIdValidator().optional(),
      userId: documentIdValidator().optional(),
      status: z.nativeEnum(QuizAttemptStatusEnum).optional(),
    })
    .optional(),
});

export const quizAttemptRouter = router({
  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(CreateQuizAttemptSchema)
    .mutation(async ({ ctx, input }) => {
      const attempt = await QuizAttemptModel.create({
        ...input.data,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
        startedAt: input.data.startedAt || new Date(),
      });
      return jsonify(attempt.toObject());
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      getFormDataSchema({
        status: z.nativeEnum(QuizAttemptStatusEnum).optional(),
        completedAt: z.date().optional(),
        expiresAt: z.date().optional(),
        score: z.number().min(0).optional(),
        percentageScore: z.number().min(0).max(100).optional(),
        passed: z.boolean().optional(),
        timeSpent: z.number().min(0).optional(),
      }, {
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const attempt = await QuizAttemptModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!attempt) throw new NotFoundException("Quiz attempt", input.id);
      if (!attempt.userId.equals(ctx.user._id)) {
        throw new AuthorizationException();
      }
      Object.keys(input.data).forEach((key) => {
        (attempt as any)[key] = (input.data as any)[key];
      });
      const saved = await attempt.save();
      return jsonify(saved.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(z.object({
      id: documentIdValidator(),
    }))
    .mutation(async ({ ctx, input }) => {
      const attempt = await QuizAttemptModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!attempt) throw new NotFoundException("Quiz attempt", input.id);
      await QuizAttemptModel.findByIdAndDelete(input.id);
      return { success: true };
    }),

  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const attempt = await QuizAttemptModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          user: Pick<IUserHydratedDocument, "username" | "fullName" | "email">;
        }>("user", "username fullName email")
        .populate<{
          quiz: Pick<IQuizHydratedDocument, "title" | "totalPoints">;
        }>("quiz", "title totalPoints")
        .lean();

      if (!attempt) throw new NotFoundException("Quiz attempt not found");
      return jsonify(attempt);
    }),

  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(QuizAttemptListInputSchema)
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof QuizAttemptModel> = {
        orgId: ctx.domainData.domainObj.orgId,
        ...(input.filter?.quizId ? { quizId: input.filter.quizId } : {}),
        ...(input.filter?.userId ? { userId: input.filter.userId } : {}),
        ...(input.filter?.status ? { status: input.filter.status } : {}),
      };
      const paginationMeta = paginate(input.pagination);
      const [items, total] = await Promise.all([
        QuizAttemptModel.find(query)
          .populate<{
            user: Pick<IUserHydratedDocument, "username" | "fullName" | "email">;
          }>("user", "username fullName email")
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
        paginationMeta.includePaginationCount
          ? QuizAttemptModel.countDocuments(query)
          : Promise.resolve(0),
      ]);

      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),
  listMine: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            status: z.nativeEnum(QuizAttemptStatusEnum).optional(),
            passed: z.boolean().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const hasAccess = checkPermission(ctx.user.permissions, [
        UIConstants.permissions.enrollInCourse,
      ]);
      if (!hasAccess) throw new AuthorizationException();

      const query: RootFilterQuery<typeof QuizAttemptModel> = {
        orgId: ctx.domainData.domainObj.orgId,
        userId: ctx.user._id,
        ...(input.filter?.status ? { status: input.filter.status } : {}),
        ...(typeof input.filter?.passed !== "undefined"
          ? { passed: input.filter?.passed }
          : {}),
      } as any;

      const paginationMeta = paginate(input.pagination);
      const [items, total] = await Promise.all([
        QuizAttemptModel.find(query)
          .populate<{ quiz: Pick<IQuizHydratedDocument, "title" | "totalPoints"> }>(
            "quiz",
            "title totalPoints",
          )
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
        paginationMeta.includePaginationCount
          ? QuizAttemptModel.countDocuments(query)
          : Promise.resolve(0),
      ]);

      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  getCurrentUserAttempt: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        quizId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      const attempt = await QuizAttemptModel.findOne({
        quizId: input.quizId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          user: Pick<IUserHydratedDocument, "username" | "fullName" | "email">;
        }>("user", "username fullName email")
        .populate<{
          quiz: Pick<IQuizHydratedDocument, "title" | "totalPoints">;
        }>("quiz", "title totalPoints")
        .lean();

      if (!attempt) throw new NotFoundException("Quiz attempt not found");

      return jsonify(attempt);
    }),

  regrade: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(z.object({
      id: documentIdValidator(),
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await regradeQuizAttempt(input.id);

      if (!result.success) {
        throw new Error(result.message);
      }

      // Return the updated attempt data
      const attempt = await QuizAttemptModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          user: Pick<IUserHydratedDocument, "username" | "fullName" | "email">;
        }>("user", "username fullName email")
        .populate<{
          quiz: Pick<IQuizHydratedDocument, "title" | "totalPoints">;
        }>("quiz", "title totalPoints")
        .lean();

      if (!attempt) throw new NotFoundException("Quiz attempt not found");

      return jsonify(attempt);
    }),
});
