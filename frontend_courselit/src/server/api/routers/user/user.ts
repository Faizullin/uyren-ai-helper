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
import { mediaWrappedFieldValidator } from "@/server/api/core/validators";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { UserModel } from "@workspace/common-logic/models/user.model";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";

export const userRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageUsers]),
    )
    .input(ListInputSchema)
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof UserModel> = {
        orgId: ctx.domainData.domainObj.orgId,
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
        UserModel.find(query)
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? UserModel.countDocuments(query)
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
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageUsers]),
    )
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const user = await UserModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!user) {
        throw new NotFoundException("User", input.id);
      }

      return jsonify(user);
    }),

  getProfile: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .query(async ({ ctx }) => {
      const user = await UserModel.findOne({
        _id: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!user) {
        throw new NotFoundException("User", ctx.user._id);
      }

      return jsonify(user);
    }),

  updateProfile: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        username: z.string().min(2).max(100).optional(),
        firstName: z.string().min(1).max(100).optional(),
        lastName: z.string().min(1).max(100).optional(),
        bio: z.string().max(500).optional(),
        avatar: mediaWrappedFieldValidator().nullable().optional(),
        subscribedToUpdates: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await UserModel.findOne({
        _id: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!user) {
        throw new NotFoundException("User", ctx.user._id.toString());
      }

      Object.keys(input.data).forEach((key) => {
        (user as any)[key] = (input.data as any)[key];
      });

      const saved = await user.save();
      return jsonify(saved.toObject());
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageUsers]),
    )
    .input(
      getFormDataSchema(
        {
          username: z.string().min(2).max(100).optional(),
          firstName: z.string().min(1).max(100).optional(),
          lastName: z.string().min(1).max(100).optional(),
          bio: z.string().max(500).optional(),
          avatar: mediaWrappedFieldValidator().nullable().optional(),
          active: z.boolean().optional(),
          permissions: z.array(z.string()).optional(),
          roles: z.array(z.string()).optional(),
          subscribedToUpdates: z.boolean().optional(),
        },
        {
          id: z.string(),
        },
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await UserModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!user) {
        throw new NotFoundException("User", input.id);
      }

      if (user._id.equals(ctx.user._id)) {
        const restrictedKeys = ["permissions", "roles", "active"];
        const hasRestrictedKey = Object.keys(input.data).some((key) =>
          restrictedKeys.includes(key),
        );

        if (hasRestrictedKey) {
          throw new AuthorizationException("You are not authorized to update for yourself");
        }
      }

      Object.keys(input.data).forEach((key) => {
        (user as any)[key] = (input.data as any)[key];
      });

      const saved = await user.save();
      return jsonify(saved.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageUsers]),
    )
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await UserModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!user) {
        throw new NotFoundException("User", input.id);
      }

      if (user._id.equals(ctx.user._id)) {
        throw new AuthorizationException();
      }

      await UserModel.deleteOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      return { success: true };
    }),
});
