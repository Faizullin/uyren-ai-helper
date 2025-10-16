import {
  NotFoundException,
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  protectedProcedure,
} from "@/server/api/core/procedures";
import { ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { jsonify } from "@workspace/common-logic/lib/response";
import { NotificationModel } from "@workspace/common-logic/models/notification.model";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";

export const notificationRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(ListInputSchema)
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof NotificationModel> = {
        orgId: ctx.domainData.domainObj.orgId,
        recipientId: ctx.user._id,
      };

      if (input.search?.q) {
        query.$text = { $search: input.search.q };
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
        NotificationModel.find(query)
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? NotificationModel.countDocuments(query)
          : Promise.resolve(null),
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
      const notification = await NotificationModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
        recipientId: ctx.user._id,
      }).lean();

      if (!notification) {
        throw new NotFoundException("Notification", input.id);
      }

      return jsonify(notification);
    }),

  markAsRead: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const notification = await NotificationModel.findOneAndUpdate(
        {
          _id: input.id,
          orgId: ctx.domainData.domainObj.orgId,
          recipientId: ctx.user._id,
        },
        { $set: { read: true } },
        { new: true },
      );

      if (!notification) {
        throw new NotFoundException("Notification", input.id);
      }

      return jsonify(notification.toObject());
    }),

  markAllAsRead: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .mutation(async ({ ctx }) => {
      await NotificationModel.updateMany(
        {
          orgId: ctx.domainData.domainObj.orgId,
          recipientId: ctx.user._id,
          read: false,
        },
        { $set: { read: true } },
      );

      return { success: true };
    }),

  getUnreadCount: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .query(async ({ ctx }) => {
      const count = await NotificationModel.countDocuments({
        orgId: ctx.domainData.domainObj.orgId,
        recipientId: ctx.user._id,
        read: false,
      });

      return jsonify({ count });
    }),
});
