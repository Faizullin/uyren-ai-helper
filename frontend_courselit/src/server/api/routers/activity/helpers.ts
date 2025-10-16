import { ActivityTypeEnum } from "@workspace/common-logic/lib/ui/activity";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { ActivityModel } from "@workspace/common-logic/models/activity.model";
import { IDomain } from "@workspace/common-logic/models/organization.types";
import { checkPermission } from "@workspace/utils";
import mongoose from "mongoose";
import { AuthenticationException } from "../../core/exceptions";
import { MainContextType } from "../../core/procedures";

type ActivitiesType = {
    count: number;
    points?: { date: Date; count: number }[];
    growth?: number;
};

export const getActivities = async ({
    ctx,
    type,
    duration,
    points = false,
    growth = false,
    entityId,
}: {
    ctx: MainContextType;
    type: ActivityTypeEnum;
    duration: "1d" | "7d" | "30d" | "90d" | "1y" | "lifetime";
    points?: boolean;
    growth?: boolean;
    entityId?: string;
}): Promise<ActivitiesType> => {
    if (!checkPermission(ctx.user.permissions, [UIConstants.permissions.manageSettings])) {
        throw new AuthenticationException();
    }

    let startFromDate = calculatePastDate(duration, ctx.domainData.domainObj);
    let extendedStartDate = growth
        ? calculatePastDate(
            duration,
            ctx.domainData.domainObj,
            new Date(startFromDate.getTime() - 1),
        )
        : startFromDate;

    // Single query for both current and previous period
    const query = {
        createdAt: { $gte: extendedStartDate },
        type,
        orgId: ctx.domainData.domainObj.orgId,
        ...(entityId ? { entityId } : {}),
    };
    const activities = await ActivityModel.find(query).lean();

    // Split activities into current and previous periods
    const currentPeriodActivities = activities.filter(
        (activity: any) => new Date(activity.createdAt!) >= startFromDate,
    );

    const count = currentPeriodActivities.reduce(
        (acc, activity) =>
            acc + (type === "purchased" ? activity.metadata?.cost || 0 : 1),
        0,
    );

    let result: ActivitiesType = { count };

    if (growth) {
        const previousPeriodActivities = activities.filter(
            (activity: any) => new Date(activity.createdAt!) < startFromDate,
        );
        const previousCount = previousPeriodActivities.reduce(
            (acc, activity) =>
                acc + (type === "purchased" ? activity.metadata?.cost || 0 : 1),
            0,
        );
        result.growth =
            previousCount === 0 && count > 0
                ? 100
                : previousCount
                    ? Number((((count - previousCount) / previousCount) * 100).toFixed(2))
                    : 0;
    }

    if (points) {
        const pointsMap = new Map<string, number>();
        const today = new Date();
        let date = new Date(startFromDate);

        // Pre-fill all dates with 0
        while (date <= today) {
            const tmp = date.toISOString().split("T")[0];
            if (!tmp) {
                throw new Error("Invalid date format");
            }
            pointsMap.set(tmp, 0);
            date.setUTCDate(date.getUTCDate() + 1);
        }

        // Fill in actual values
        currentPeriodActivities.forEach((activity: any) => {
            const dateStr = new Date(activity.createdAt!).toISOString().split("T")[0];
            if (!dateStr) {
                throw new Error("Invalid date format");
            }
            const currentValue = pointsMap.get(dateStr) || 0;
            pointsMap.set(
                dateStr,
                currentValue +
                (type === "purchased" ? activity.metadata?.cost || 0 : 1),
            );
        });

        result.points = Array.from(pointsMap).map(([date, count]) => ({
            date: new Date(date),
            count,
        }));
    }

    return result;
};

export const calculatePastDate = (
    duration: "1d" | "7d" | "30d" | "90d" | "1y" | "lifetime",
    domain: IDomain & { _id: mongoose.Types.ObjectId },
    from?: Date,
): Date => {
    const startDate = from || new Date();
    let result: Date = new Date(startDate.getTime());

    result.setUTCHours(0, 0, 0, 0);

    switch (duration) {
        case "1d":
            result.setUTCDate(result.getUTCDate() - 0);
            break;
        case "7d":
            result.setUTCDate(result.getUTCDate() - 6);
            break;
        case "30d":
            result.setUTCDate(result.getUTCDate() - 29);
            break;
        case "90d":
            result.setUTCDate(result.getUTCDate() - 89);
            break;
        case "1y":
            result.setUTCFullYear(result.getUTCFullYear() - 1);
            break;
        case "lifetime":
            result = new Date((domain as any).createdAt!);
            break;
        default:
            throw new Error("Invalid duration");
    }

    return result;
};
