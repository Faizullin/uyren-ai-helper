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
import { AssignmentSubmissionModel, IAssignmentHydratedDocument } from "@workspace/common-logic/models/lms/assignment.model";
import { AssignmentSubmissionStatusEnum } from "@workspace/common-logic/models/lms/assignment.types";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";


export const assignmentSubmissionRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            assignmentId: z.string().optional(),
            userId: z.string().optional(),
            status: z
              .nativeEnum(AssignmentSubmissionStatusEnum)
              .optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof AssignmentSubmissionModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };
      if (input.filter?.assignmentId)
        query.assignmentId = input.filter.assignmentId;
      if (input.filter?.userId) query.userId = input.filter.userId;
      if (input.filter?.status) query.status = input.filter.status;
      const paginationMeta = paginate(input.pagination);
      const [items, total] = await Promise.all([
        AssignmentSubmissionModel.find(query)
          .populate<{
            assignment: Pick<IAssignmentHydratedDocument, "title" | "totalPoints">;
          }>("assignment", "title totalPoints")
          .populate<{
            student: Pick<IUserHydratedDocument, "username" | "firstName" | "lastName" | "fullName" | "email">;
          }>("student", "username firstName lastName fullName email")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(
            input.orderBy
              ? {
                [input.orderBy.field]:
                  input.orderBy.direction === "asc" ? 1 : -1,
              }
              : { submittedAt: -1 },
          )
          .lean(),
        paginationMeta.includePaginationCount
          ? AssignmentSubmissionModel.countDocuments(query)
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
            status: z.nativeEnum(AssignmentSubmissionStatusEnum).optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const hasAccess = checkPermission(ctx.user.permissions, [
        UIConstants.permissions.enrollInCourse,
      ]);
      if (!hasAccess) throw new AuthorizationException();

      const query: RootFilterQuery<typeof AssignmentSubmissionModel> = {
        orgId: ctx.domainData.domainObj.orgId,
        userId: ctx.user._id,
        ...(input.filter?.status ? { status: input.filter.status } : {}),
      };

      const paginationMeta = paginate(input.pagination);
      const [items, total] = await Promise.all([
        AssignmentSubmissionModel.find(query)
          .populate<{ assignment: Pick<IAssignmentHydratedDocument, "title" | "totalPoints"> }>(
            "assignment",
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
              : { submittedAt: -1 },
          )
          .lean(),
        paginationMeta.includePaginationCount
          ? AssignmentSubmissionModel.countDocuments(query)
          : Promise.resolve(0),
      ]);

      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const submission = await AssignmentSubmissionModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          assignment: Pick<IAssignmentHydratedDocument, "_id" | "title" | "totalPoints" | "instructions">;
        }>("assignment", "title totalPoints instructions")
        .populate<{
          student: Pick<IUserHydratedDocument, "username" | "firstName" | "lastName" | "fullName" | "email">;
        }>("student", "username firstName lastName fullName email")
        .lean();

      if (!submission) throw new NotFoundException("Submission", input.id);

      const hasAccess = checkPermission(ctx.user.permissions, [
        UIConstants.permissions.manageAnyCourse,
      ]);
      if (!hasAccess) throw new AuthorizationException();

      return jsonify(submission);
    }),

  grade: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      getFormDataSchema({
        score: z.number().min(0),
        feedback: z.string().optional(),
        rubricScores: z.array(z.object({
          criterion: z.string(),
          maxScore: z.number().min(0),
          feedback: z.string().optional(),
        })).optional(),
      }, {
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await AssignmentSubmissionModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!submission) throw new NotFoundException("Submission", input.id);

      submission.score = input.data.score;
      submission.feedback = input.data.feedback;
      submission.status = AssignmentSubmissionStatusEnum.GRADED;
      submission.gradedAt = new Date();
      submission.gradedById = ctx.user._id;

      const saved = await submission.save();
      return jsonify(saved.toObject());
    }),

  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        assignmentId: documentIdValidator(),
        content: z.string().default(""),
        attachments: z.array(z.string()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await AssignmentSubmissionModel.create({
        ...input.data,
        orgId: ctx.domainData.domainObj.orgId,
        userId: ctx.user._id,
        submittedAt: new Date(),
        attemptNumber: 1,
        status: AssignmentSubmissionStatusEnum.SUBMITTED,
      });
      return jsonify(submission.toObject());
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        content: z.string().optional(),
        attachments: z.array(z.string()).optional(),
      }, {
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await AssignmentSubmissionModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
        userId: ctx.user._id,
      });
      if (!submission) throw new NotFoundException("Submission", input.id);

      Object.keys(input.data).forEach((key) => {
        (submission as any)[key] = (input.data as any)[key];
      });
      const saved = await submission.save();
      return jsonify(saved.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(z.object({
      id: documentIdValidator(),
    }))
    .mutation(async ({ ctx, input }) => {
      const submission = await AssignmentSubmissionModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!submission) throw new NotFoundException("Submission", input.id);

      await AssignmentSubmissionModel.findByIdAndDelete(input.id);
      return { success: true };
    }),
});
