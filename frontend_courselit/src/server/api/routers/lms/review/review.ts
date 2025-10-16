import { Log } from "@/lib/logger";
import { NotFoundException } from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  protectedProcedure,
  publicProcedure
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import {
  documentIdValidator,
  mediaWrappedFieldValidator
} from "@/server/api/core/validators";
import { deleteMedia } from "@/server/services/media";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { ReviewModel } from "@workspace/common-logic/models/review.model";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import { FilterQuery, RootFilterQuery } from "mongoose";
import { z } from "zod";


export const reviewRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([
        UIConstants.permissions.manageCourse,
        UIConstants.permissions.manageAnyCourse,
      ]),
    )
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            published: z.boolean().optional(),
            featured: z.boolean().optional(),
            targetType: z.string().optional(),
            targetId: documentIdValidator().optional(),
          })
          .optional()
          .default({}),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof ReviewModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ])
      ) {
        query.authorId = ctx.user._id;
      }

      if (input.filter.published !== undefined) {
        query.published = input.filter.published;
      }

      if (input.filter.featured !== undefined) {
        query.featured = input.filter.featured;
      }

      if (input.filter.targetType) {
        query["target.entityType"] = input.filter.targetType;
      }

      if (input.filter.targetId) {
        query["target.entityId"] = input.filter.targetId;
      }

      if (input.search?.q) query.$text = { $search: input.search.q };

      const paginationMeta = paginate(input.pagination);
      const orderBy = input.orderBy || {
        field: "createdAt",
        direction: "desc",
      };
      const sortObject: Record<string, 1 | -1> = {
        [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
      };

      const [items, total] = await Promise.all([
        ReviewModel.find(query)
          .populate<{
            author: Pick<IUserHydratedDocument, "_id" | "username" | "fullName" | "avatar">;
          }>("author", "username fullName avatar")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? ReviewModel.countDocuments(query as any)
          : Promise.resolve(null),
      ]);

      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  getByReviewId: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        reviewId: z.string(),
        asGuest: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const review = await ReviewModel.findOne({
        reviewId: input.reviewId,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          author: Pick<IUserHydratedDocument, "username" | "fullName" | "avatar">;
        }>("author", "username fullName avatar")
        .lean();

      if (!review) {
        throw new NotFoundException("Review", input.reviewId);
      }

      const hasAccess = checkPermission(ctx.user.permissions, [
        UIConstants.permissions.manageAnyCourse,
      ]);

      if (!hasAccess && review.authorId !== ctx.user._id) {
        if (!review.published) {
          throw new NotFoundException("Review", input.reviewId);
        }
      }

      return jsonify(review);
    }),

  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([
        UIConstants.permissions.manageCourse,
        UIConstants.permissions.manageAnyCourse,
      ]),
    )
    .input(
      getFormDataSchema({
        title: z.string().min(1).max(200),
        content: z.string(),
        rating: z.number().min(1).max(10),
        targetType: z.string().min(1),
        targetId: documentIdValidator().optional(),
        published: z.boolean().default(false),
        featured: z.boolean().default(false),
        featuredImage: mediaWrappedFieldValidator().optional(),
        tags: z.array(documentIdValidator()).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const review = await ReviewModel.create({
        ...input.data,
        orgId: ctx.domainData.domainObj.orgId,
        authorId: ctx.user._id,
        target: {
          entityType: input.data.targetType,
          entityId: input.data.targetId,
          entityIdStr: input.data.targetId,
        },
      });

      Log.info("Review created", {
        reviewId: review._id,
        userId: ctx.user._id,
      });
      return jsonify(review.toObject());
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([
        UIConstants.permissions.manageCourse,
        UIConstants.permissions.manageAnyCourse,
      ]),
    )
    .input(
      getFormDataSchema({
        title: z.string().min(1).max(200).optional(),
        content: z.string().optional(),
        rating: z.number().min(1).max(10).optional(),
        targetType: z.string().min(1).optional(),
        targetId: documentIdValidator().optional(),
        published: z.boolean().optional(),
        featured: z.boolean().optional(),
        featuredImage: mediaWrappedFieldValidator().optional(),
        tags: z.array(documentIdValidator()).optional(),
        authorId: documentIdValidator().optional(),
      }, {
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const review = await ReviewModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!review) throw new NotFoundException("Review", input.id);

      if (
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ]) &&
        !review.authorId.equals(ctx.user._id)
      ) {
        throw new Error("You don't have permission to update this review");
      }

      const updateData: FilterQuery<typeof ReviewModel> = {};
      if (input.data.title !== undefined) updateData.title = input.data.title;
      if (input.data.content !== undefined)
        updateData.content = input.data.content;
      if (input.data.rating !== undefined)
        updateData.rating = input.data.rating;
      if (input.data.targetType !== undefined)
        updateData.targetType = input.data.targetType;
      if (input.data.targetId !== undefined)
        updateData.targetId = input.data.targetId;
      if (input.data.published !== undefined)
        updateData.published = input.data.published;
      if (input.data.featured !== undefined)
        updateData.featured = input.data.featured;
      if (input.data.featuredImage !== undefined)
        updateData.featuredImage = input.data.featuredImage;
      if (input.data.tags !== undefined) updateData.tags = input.data.tags;
      if (input.data.authorId !== undefined)
        updateData.authorId = input.data.authorId;

      const saved = await review.save();

      Log.info("Review updated", {
        reviewId: saved._id,
        userId: ctx.user._id,
      });
      return jsonify(saved.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([
        UIConstants.permissions.manageCourse,
        UIConstants.permissions.manageAnyCourse,
      ]),
    )
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const review = await ReviewModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!review) throw new NotFoundException("Review", input.id);

      if (
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ]) &&
        !review.authorId.equals(ctx.user._id)
      ) {
        throw new Error("You don't have permission to delete this review");
      }

      if (review.featuredImage) {
        await deleteMedia(review.featuredImage);
      }

      await ReviewModel.findByIdAndDelete(input.id);

      Log.info("Review deleted", {
        reviewId: input.id,
        userId: ctx.user._id,
      });
      return { success: true };
    }),

  publicGetById: publicProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const review = await ReviewModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
        published: true,
      })
        .populate<{
          author: Pick<IUserHydratedDocument, "username" | "fullName" | "avatar">;
        }>("author", "username fullName avatar")
        .lean();

      if (!review) {
        throw new NotFoundException("Review", input.id);
      }

      return jsonify(review);
    }),
});
