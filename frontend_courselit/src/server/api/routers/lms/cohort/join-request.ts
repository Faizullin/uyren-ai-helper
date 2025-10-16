import {
  ConflictException,
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
import { ApprovalStatusEnum } from "@workspace/common-logic/lib/approval_status";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { CohortJoinRequestModel } from "@workspace/common-logic/models/lms/cohort-join-request.model";
import {
  CohortModel,
} from "@workspace/common-logic/models/lms/cohort.model";
import { CohortStatusEnum, ICohort } from "@workspace/common-logic/models/lms/cohort.types";
import {
  EnrollmentModel,
} from "@workspace/common-logic/models/lms/enrollment.model";
import { EnrollmentStatusEnum } from "@workspace/common-logic/models/lms/enrollment.types";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";

export const joinRequestRouter = router({
  studentRequestJoin: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        cohortId: documentIdValidator(),
        inviteCode: z.string().min(6).max(50),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const cohort = await CohortModel.findOne({
        _id: input.data.cohortId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!cohort) {
        throw new NotFoundException("Cohort", input.data.cohortId);
      }

      if (
        cohort.status === CohortStatusEnum.COMPLETED ||
        cohort.status === CohortStatusEnum.CANCELLED
      ) {
        throw new ConflictException("Cohort is not accepting new students");
      }

      if (!cohort.inviteCode || cohort.inviteCode !== input.data.inviteCode) {
        throw new ConflictException("Invalid invite code");
      }

      const userId = ctx.user._id;
      const email = ctx.user.email;

      if (!email) {
        throw new ConflictException("User email is required");
      }

      const existingEnrollment = await EnrollmentModel.findOne({
        userId: userId,
        cohortId: input.data.cohortId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (existingEnrollment) {
        throw new ConflictException("You are already enrolled in this cohort");
      }

      const existingRequest = await CohortJoinRequestModel.findOne({
        cohortId: input.data.cohortId,
        userId: userId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (existingRequest) {
        return jsonify({
          status: "existing",
          message: "Join request already exists",
          request: existingRequest.toObject(),
        });
      }

      if (cohort.maxCapacity) {
        const currentCount = await EnrollmentModel.countDocuments({
          cohortId: input.data.cohortId,
          status: EnrollmentStatusEnum.ACTIVE,
          orgId: ctx.domainData.domainObj.orgId,
        });

        const pendingCount = await CohortJoinRequestModel.countDocuments({
          cohortId: input.data.cohortId,
          status: ApprovalStatusEnum.PENDING,
          orgId: ctx.domainData.domainObj.orgId,
        });

        if (currentCount + pendingCount >= cohort.maxCapacity) {
          throw new ConflictException("Cohort has reached maximum capacity");
        }
      }

      const joinRequest = await CohortJoinRequestModel.create({
        cohortId: input.data.cohortId,
        userId: userId,
        email: email,
        orgId: ctx.domainData.domainObj.orgId,
        status: ApprovalStatusEnum.PENDING,
      });

      return jsonify({
        status: "created",
        message: "Join request submitted successfully",
        request: joinRequest.toObject(),
      });
    }),

  studentListMyJoinRequests: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(ListInputSchema)
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof CohortJoinRequestModel> = {
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      };

      const paginationMeta = paginate(input.pagination);
      const [items, total] = await Promise.all([
        CohortJoinRequestModel.find(query)
          .populate<{
            cohort: Pick<ICohort, "title" | "status">;
          }>("cohort", "title status")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort({ createdAt: -1 })
          .lean(),
        paginationMeta.includePaginationCount
          ? CohortJoinRequestModel.countDocuments(query)
          : Promise.resolve(null),
      ]);

      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            cohortId: documentIdValidator().optional(),
            status: z.nativeEnum(ApprovalStatusEnum).optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof CohortJoinRequestModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (input.filter?.cohortId) {
        query.cohortId = input.filter.cohortId;
      }

      if (input.filter?.status) {
        query.status = input.filter.status;
      }

      const paginationMeta = paginate(input.pagination);
      const [items, total] = await Promise.all([
        CohortJoinRequestModel.find(query)
          .populate<{
            user: Pick<
              IUserHydratedDocument,
              "username" | "firstName" | "lastName" | "fullName" | "email"
            >;
          }>("user", "username firstName lastName fullName email")
          .populate<{
            cohort: Pick<ICohort, "title" | "status">;
          }>("cohort", "title status")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort({ createdAt: -1 })
          .lean(),
        paginationMeta.includePaginationCount
          ? CohortJoinRequestModel.countDocuments(query)
          : Promise.resolve(null),
      ]);

      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  approve: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(z.object({ id: documentIdValidator() }))
    .mutation(async ({ ctx, input }) => {
      const joinRequest = await CohortJoinRequestModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!joinRequest) {
        throw new NotFoundException("Join Request", input.id);
      }

      if (joinRequest.status !== ApprovalStatusEnum.PENDING) {
        throw new ConflictException("Only pending requests can be approved");
      }

      const cohort = await CohortModel.findOne({
        _id: joinRequest.cohortId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!cohort) {
        throw new NotFoundException("Cohort", joinRequest.cohortId.toString());
      }

      if (cohort.maxCapacity) {
        const currentEnrollments = await EnrollmentModel.countDocuments({
          cohortId: joinRequest.cohortId,
          status: EnrollmentStatusEnum.ACTIVE,
          orgId: ctx.domainData.domainObj.orgId,
        });

        if (currentEnrollments >= cohort.maxCapacity) {
          throw new ConflictException("Cohort has reached maximum capacity");
        }
      }

      joinRequest.status = ApprovalStatusEnum.APPROVED;
      const saved = await joinRequest.save();

      // TODO: Create enrollment automatically after approval (like Frappe LMS)

      return jsonify(saved.toObject());
    }),

  reject: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(z.object({ id: documentIdValidator() }))
    .mutation(async ({ ctx, input }) => {
      const joinRequest = await CohortJoinRequestModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!joinRequest) {
        throw new NotFoundException("Join Request", input.id);
      }

      if (joinRequest.status === ApprovalStatusEnum.REJECTED) {
        throw new ConflictException("Request is already rejected");
      }

      joinRequest.status = ApprovalStatusEnum.REJECTED;
      const saved = await joinRequest.save();

      return jsonify(saved.toObject());
    }),

  undoReject: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(z.object({ id: documentIdValidator() }))
    .mutation(async ({ ctx, input }) => {
      const joinRequest = await CohortJoinRequestModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!joinRequest) {
        throw new NotFoundException("Join Request", input.id);
      }

      if (joinRequest.status !== ApprovalStatusEnum.REJECTED) {
        throw new ConflictException("Only rejected requests can be undone");
      }

      joinRequest.status = ApprovalStatusEnum.PENDING;
      const saved = await joinRequest.save();

      return jsonify(saved.toObject());
    }),
});

