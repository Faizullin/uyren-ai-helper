import { z } from "zod";
import { router } from "@/server/api/core/trpc";
import {
  createDomainRequiredMiddleware,
  protectedProcedure,
} from "@/server/api/core/procedures";
import { ListInputSchema } from "@/server/api/core/schema";
import { CloudinaryService } from "@/server/services/cloudinary";
import { deleteMedia } from "@/server/services/media";

export const mediaRouter = router({
  // List media files (for admin dashboard)
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      ListInputSchema.extend({
        userId: z.string().optional(),
        storageProvider: z.string().optional(),
        mimeType: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { pagination, search, userId, storageProvider, mimeType } = input;
      const skip = pagination?.skip || 0;
      const take = pagination?.take || 10;
      const q = search?.q;

      if (!ctx.domainData.domainObj) {
        throw new Error("Domain not found");
      }

      // Build search query
      const searchQuery: any = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (q) {
        searchQuery.$or = [
          { originalFileName: { $regex: q, $options: "i" } },
          { caption: { $regex: q, $options: "i" } },
        ];
      }

      if (userId) {
        searchQuery.userId = userId;
      }

      if (storageProvider) {
        searchQuery.storageProvider = storageProvider;
      }

      if (mimeType) {
        searchQuery.mimeType = { $regex: mimeType, $options: "i" };
      }

      // Get total count
      const total = await MediaModel.countDocuments(searchQuery);

      // Get paginated results
      const items = await MediaModel.find(searchQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(take)
        .lean();

      const paginationMeta = {
        total,
        skip,
        take,
        hasMore: skip + take < total,
      };

      return {
        items,
        total,
        meta: paginationMeta,
      };
    }),

  // Get media by ID
  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        mediaId: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { mediaId } = input;

      if (!ctx.domainData.domainObj) {
        throw new Error("Domain not found");
      }

      const media = await MediaModel.findOne({
        mediaId,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!media) {
        throw new Error("Media not found");
      }

      return media;
    }),

  // Generate secure URL for media
  getSecureUrl: protectedProcedure
    .input(
      z.object({
        mediaId: z.string(),
        transformation: z
          .object({
            width: z.number().optional(),
            height: z.number().optional(),
            crop: z.string().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { mediaId, transformation } = input;

      try {
        // For now, only Cloudinary is supported
        const url = CloudinaryService.generateSecureUrl(
          mediaId,
          transformation,
        );
        return { url };
      } catch (error: any) {
        throw new Error(`URL generation failed: ${error.message}`);
      }
    }),

  // Generate public URL for media
  getPublicUrl: protectedProcedure
    .input(
      z.object({
        mediaId: z.string(),
        transformation: z
          .object({
            width: z.number().optional(),
            height: z.number().optional(),
            crop: z.string().optional(),
            quality: z.string().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { mediaId, transformation } = input;

      try {
        // For now, only Cloudinary is supported
        const url = CloudinaryService.generatePublicUrl(
          mediaId,
          transformation,
        );
        return { url };
      } catch (error: any) {
        throw new Error(`URL generation failed: ${error.message}`);
      }
    }),

  // Get media statistics
  getStats: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .query(async ({ ctx }) => {
      const stats = await MediaModel.aggregate([
        {
          $match: {
            orgId: ctx.domainData.domainObj.orgId,
          },
        },
        {
          $group: {
            _id: null,
            totalFiles: { $sum: 1 },
            totalSize: { $sum: "$size" },
            byStorageProvider: {
              $push: {
                provider: "$storageProvider",
                size: "$size",
              },
            },
            byMimeType: {
              $push: {
                mimeType: "$mimeType",
                count: 1,
              },
            },
          },
        },
      ]);

      const result = stats[0] || {
        totalFiles: 0,
        totalSize: 0,
        byStorageProvider: [],
        byMimeType: [],
      };

      // Process storage provider stats
      const storageStats = result.byStorageProvider.reduce(
        (acc: any, item: any) => {
          if (!acc[item.provider]) {
            acc[item.provider] = { count: 0, totalSize: 0 };
          }
          acc[item.provider].count += 1;
          acc[item.provider].totalSize += item.size;
          return acc;
        },
        {},
      );

      // Process mime type stats
      const mimeTypeStats = result.byMimeType.reduce((acc: any, item: any) => {
        if (!acc[item.mimeType]) {
          acc[item.mimeType] = 0;
        }
        acc[item.mimeType] += 1;
        return acc;
      }, {});

      return {
        totalFiles: result.totalFiles,
        totalSize: result.totalSize,
        averageSize:
          result.totalFiles > 0 ? result.totalSize / result.totalFiles : 0,
        storageProviders: storageStats,
        mimeTypes: mimeTypeStats,
      };
    }),

  // Delete media by ID
  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        mediaId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Ensure media belongs to this domain before deleting upstream
      const existing = await MediaModel.findOne({
        mediaId: input.mediaId,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();
      if (!existing) {
        throw new Error("Media not found");
      }
      await deleteMedia(input.mediaId);
      await MediaModel.deleteOne({ mediaId: input.mediaId, domain: ctx.domainData.domainObj._id });
      return { success: true };
    }),
});
