import {
    createDomainRequiredMiddleware,
    protectedProcedure,
} from "@/server/api/core/procedures";
import { router } from "@/server/api/core/trpc";
import { ActivityTypeEnum } from "@workspace/common-logic/lib/ui/activity";
import { ActivityModel } from "@workspace/common-logic/models/activity.model";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";
import { getActivities } from "./helpers";

const GetActivitiesInputSchema = z.object({
    params: z.object({
        type: z.nativeEnum(ActivityTypeEnum),
        duration: z.enum(["1d", "7d", "30d", "90d", "1y", "lifetime"]),
        points: z.boolean().optional().default(false),
        growth: z.boolean().optional().default(true),
        entityId: z.string().optional(),
    }),
});

export const activityRouter = router({
    // Get activities with analytics data
    getActivities: protectedProcedure
        .use(createDomainRequiredMiddleware())
        .input(GetActivitiesInputSchema)
        .query(async ({ ctx, input }) => {
            const { type, duration, points, growth, entityId } = input.params;

            const result = await getActivities({
                ctx: ctx as any,
                type,
                duration,
                points,
                growth,
                entityId,
            });

            return {
                success: true,
                data: result,
            };
        }),

    // Get user's own activities
    getMyActivities: protectedProcedure
        .input(
            z.object({
                type: z
                    .nativeEnum(ActivityTypeEnum)
                    .optional(),
                limit: z.number().min(1).max(100).optional().default(20),
                offset: z.number().min(0).optional().default(0),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { type, limit, offset } = input;

            if (!ctx.domainData.domainObj) {
                throw new Error("Domain not found");
            }

            const query: RootFilterQuery<typeof ActivityModel> = {
                orgId: ctx.domainData.domainObj.orgId,
                userId: ctx.user.id,
            };

            if (type) {
                query.type = type;
            }

            const activities = await ActivityModel.find(query)
                .sort({ createdAt: -1 })
                .skip(offset)
                .limit(limit)
                .lean();

            const total = await ActivityModel.countDocuments(query);

            return {
                success: true,
                data: {
                    activities,
                    total,
                    meta: {
                        limit,
                        offset,
                        hasMore: offset + limit < total,
                    },
                },
            };
        }),

    // Get activity statistics for dashboard
    getActivityStats: protectedProcedure
        .input(
            z.object({
                duration: z
                    .enum(["1d", "7d", "30d", "90d", "1y", "lifetime"])
                    .default("30d"),
            }),
        )
        .query(async ({ ctx, input }) => {
            const { duration } = input;

            if (!ctx.domainData.domainObj) {
                throw new Error("Domain not found");
            }


            const startDate = new Date();
            startDate.setDate(
                startDate.getDate() -
                (duration === "1d"
                    ? 0
                    : duration === "7d"
                        ? 6
                        : duration === "30d"
                            ? 29
                            : duration === "90d"
                                ? 89
                                : 365),
            );

            const stats = await ActivityModel.aggregate([
                {
                    $match: {
                        orgId: ctx.domainData.domainObj.orgId,
                        createdAt: { $gte: startDate },
                    },
                },
                {
                    $group: {
                        _id: "$type",
                        count: { $sum: 1 },
                        totalValue: { $sum: { $ifNull: ["$metadata.cost", 0] } },
                    },
                },
            ]);

            return {
                success: true,
                data: {
                    duration,
                    stats: stats.reduce(
                        (acc, stat) => {
                            acc[stat._id] = {
                                count: stat.count,
                                totalValue: stat.totalValue,
                            };
                            return acc;
                        },
                        {} as Record<string, { count: number; totalValue: number }>,
                    ),
                },
            };
        }),
});
