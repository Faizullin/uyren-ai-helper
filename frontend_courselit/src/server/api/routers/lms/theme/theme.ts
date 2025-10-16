import {
  AuthorizationException,
  NotFoundException,
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { PublicationStatusEnum } from "@workspace/common-logic/lib/publication_status";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import {
  ThemeModel
} from "@workspace/common-logic/models/theme.model";
import { ThemeAssetTypeEnum } from "@workspace/common-logic/models/theme.types";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";

const assetSchema = z.object({
  assetType: z.nativeEnum(ThemeAssetTypeEnum),
  url: z.string().url().optional(),
  content: z.string().optional(),
  preload: z.boolean().optional(),
  async: z.boolean().optional(),
  defer: z.boolean().optional(),
  media: z.string().optional(),
  crossorigin: z.string().optional(),
  integrity: z.string().optional(),
  rel: z.string().optional(),
  sizes: z.string().optional(),
  mimeType: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
});

export const themeRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            publicationStatus: z.nativeEnum(PublicationStatusEnum).optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof ThemeModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (!checkPermission(ctx.user.permissions, [UIConstants.permissions.manageAnyCourse])) {
        query.ownerId = ctx.user._id;
      }

      if (input.filter?.publicationStatus) {
        query.publicationStatus = input.filter.publicationStatus;
      }

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
        ThemeModel.find(query)
          .populate<{
            owner: Pick<IUserHydratedDocument, "username" | "firstName" | "lastName" | "fullName" | "email">;
          }>("owner", "username firstName lastName fullName email")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? ThemeModel.countDocuments(query)
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
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const theme = await ThemeModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          owner: Pick<IUserHydratedDocument, "username" | "firstName" | "lastName" | "fullName" | "email">;
        }>("owner", "username firstName lastName fullName email")
        .lean();

      if (!theme) {
        throw new NotFoundException("Theme", input.id);
      }

      // Check access
      const hasAccess =
        checkPermission(ctx.user.permissions, [UIConstants.permissions.manageAnyCourse]) ||
        theme.ownerId.equals(ctx.user._id);

      if (!hasAccess) {
        throw new AuthorizationException();
      }

      return jsonify(theme);
    }),

  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      getFormDataSchema({
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        publicationStatus: z
          .nativeEnum(PublicationStatusEnum)
          .default(PublicationStatusEnum.DRAFT),
        assets: z.array(assetSchema).default([]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const theme = await ThemeModel.create({
        ...input.data,
        orgId: ctx.domainData.domainObj.orgId,
        ownerId: ctx.user._id,
      });
      return jsonify(theme.toObject());
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      getFormDataSchema(
        {
          name: z.string().min(1).max(255).optional(),
          description: z.string().optional(),
          publicationStatus: z.nativeEnum(PublicationStatusEnum).optional(),
          assets: z.array(assetSchema).optional(),
        },
        {
          id: documentIdValidator(),
        },
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const theme = await ThemeModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!theme) {
        throw new NotFoundException("Theme", input.id);
      }

      // Check ownership
      if (
        !theme.ownerId.equals(ctx.user._id) &&
        !checkPermission(ctx.user.permissions, [UIConstants.permissions.manageAnyCourse])
      ) {
        throw new AuthorizationException();
      }

      Object.keys(input.data).forEach((key) => {
        (theme as any)[key] = (input.data as any)[key];
      });

      const saved = await theme.save();
      return jsonify(saved.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const theme = await ThemeModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!theme) {
        throw new NotFoundException("Theme", input.id);
      }

      // Check ownership
      if (
        !theme.ownerId.equals(ctx.user._id) &&
        !checkPermission(ctx.user.permissions, [UIConstants.permissions.manageAnyCourse])
      ) {
        throw new AuthorizationException();
      }

      await ThemeModel.deleteOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
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
      const theme = await ThemeModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
        publicationStatus: PublicationStatusEnum.PUBLISHED,
      }).lean();

      if (!theme) {
        throw new NotFoundException("Theme", input.id);
      }

      return jsonify(theme);
    }),

  listAssets: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]))
    .input(z.object({ themeId: documentIdValidator() }))
    .query(async ({ ctx, input }) => {
      const theme = await ThemeModel.findOne({
        _id: input.themeId,
        orgId: ctx.domainData.domainObj.orgId,
      });
      if (!theme) {
        throw new NotFoundException("Theme", input.themeId);
      }
      return jsonify(theme.assets);
    }),
});
