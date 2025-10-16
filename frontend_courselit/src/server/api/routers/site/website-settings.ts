import WebsiteSettingsManager from "@/server/lib/website-settings-manager";
import { WebsiteSettingsModel } from "@workspace/common-logic/models/pages/website-settings.model";
import { z } from "zod";
import {
  adminProcedure,
  createDomainRequiredMiddleware,
  protectedProcedure,
  publicProcedure,
} from "../../core/procedures";
import { getFormDataSchema } from "../../core/schema";
import { router } from "../../core/trpc";
import { textEditorContentValidator } from "../../core/validators";


export const websiteSettingsRouter = router({
  // Get website settings for current domain (public)
  getPublicWebsiteSettings: publicProcedure
    .use(createDomainRequiredMiddleware())
    .query(async ({ ctx }) => {
      return await WebsiteSettingsManager.getOrCreate(ctx.domainData.domainObj);
    }),

  // Get website settings for current domain (protected)
  getWebsiteSettings: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .query(async ({ ctx }) => {
      return await WebsiteSettingsManager.getOrCreate(ctx.domainData.domainObj);
    }),

  // Update website settings
  updateWebsiteSettings: adminProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        mainPage: z.object({
          showBanner: z.boolean().optional(),
          bannerTitle: z.string().min(1, "Banner title is required").optional(),
          bannerSubtitle: z.string().optional(),
          featuredCourses: z
            .array(
              z.object({
                courseId: z.string().min(1, "Course ID is required"),
                title: z.string().min(1, "Course title is required"),
                slug: z.string().min(1, "Course slug is required"),
                shortDescription: z.string().optional(),
                level: z.enum(["beginner", "intermediate", "advanced"]),
                durationInWeeks: z.number().min(0, "Duration must be at least 0").optional(),
                featured: z.boolean(),
                order: z.number().min(0, "Order must be at least 0"),
              }),
            )
            .optional(),
          featuredReviews: z
            .array(
              z.object({
                reviewId: z.string().min(1, "Review ID is required"),
                author: z.object({
                  _id: z.string().min(1, "Author ID is required"),
                  username: z.string().optional(),
                  fullName: z.string().min(1, "Author name is required"),
                  avatar: z.any().optional(),
                }),
                rating: z
                  .number()
                  .min(1, "Rating must be at least 1")
                  .max(10, "Rating cannot exceed 10"),
                content: z.any(),
                order: z.number().min(0, "Order must be at least 0"),
              }),
            )
            .optional(),
          showStats: z.boolean().optional(),
          showFeatures: z.boolean().optional(),
          showTestimonials: z.boolean().optional(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let websiteSettings = await WebsiteSettingsModel.findOne({
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!websiteSettings) {
        // Create new settings if none exist
        websiteSettings = new WebsiteSettingsModel({
          ...input.data,
          orgId: ctx.domainData.domainObj.orgId,
        });
      } else {
        // Update existing settings
        Object.assign(websiteSettings, input.data);
      }

      await websiteSettings.save();

      // Invalidate Redis cache so it fetches fresh data
      await WebsiteSettingsManager.invalidateCache(ctx.domainData.domainObj.orgId);

      return websiteSettings;
    }),
});
