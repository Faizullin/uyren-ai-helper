import { NotFoundException } from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  protectedProcedure
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import {
  documentIdValidator
} from "@/server/api/core/validators";
import { ApprovalStatusEnum } from "@workspace/common-logic/lib/approval_status";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import {
  GrantApplicationModel,
  IGrantApplicationHydratedDocument,
} from "@workspace/common-logic/models/lms/grant-application.model";
import { FilterQuery } from "mongoose";
import { z } from "zod";

export const grantApplicationRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageSite]))
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            approvalStatus: z.nativeEnum(ApprovalStatusEnum).optional(),
          })
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const query: FilterQuery<IGrantApplicationHydratedDocument> = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (input.filter?.approvalStatus) {
        query.approvalStatus = input.filter.approvalStatus;
      }

      if (input.search?.q) {
        query.$or = [
          { fullName: { $regex: input.search.q, $options: "i" } },
          { email: { $regex: input.search.q, $options: "i" } },
        ];
      }

      const paginationMeta = paginate(input.pagination);
      const orderBy = input.orderBy || {
        field: "createdAt",
        direction: "desc",
      };
      const sortObject: Record<string, 1 | -1> = {
        [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
      };

      const [items, total] = await Promise.all([
        GrantApplicationModel.find(query)
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? GrantApplicationModel.countDocuments(query)
          : Promise.resolve(null),
      ]);

      return jsonify({ items, total, meta: paginationMeta });
    }),

  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageSite]))
    .input(
      z.object({
        id: documentIdValidator(),
      })
    )
    .query(async ({ ctx, input }) => {
      const application = await GrantApplicationModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!application) {
        throw new NotFoundException("Grant application not found");
      }

      return jsonify(application);
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageSite]))
    .input(
      getFormDataSchema({
        id: documentIdValidator(),
        approvalStatus: z.nativeEnum(ApprovalStatusEnum),
        reviewedNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const application = await GrantApplicationModel.findOne({
        _id: input.data.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!application) {
        throw new NotFoundException("Grant application not found");
      }
      if (input.data.approvalStatus) {
        application.approvalStatus = input.data.approvalStatus;
      }
      if (input.data.reviewedNotes) {
        application.reviewedNotes = input.data.reviewedNotes;
      }

      await application.save();

      return jsonify(application.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageSite]))
    .input(
      z.object({
        id: documentIdValidator(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const application = await GrantApplicationModel.findOneAndDelete({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!application) {
        throw new NotFoundException("Grant application not found");
      }

      return jsonify({ success: true });
    }),
});
