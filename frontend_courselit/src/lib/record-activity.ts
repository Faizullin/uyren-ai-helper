import ActivityModel, { Activity } from "@/models/Activity";
import { Log } from "./logger";

export async function recordActivity(activity: Activity) {
  try {
    const existingActivity = await ActivityModel.findOne({
      domain: activity.domain,
      userId: activity.userId,
      type: activity.type,
      entityId: activity.entityId,
    });

    if (existingActivity) {
      return;
    }

    await ActivityModel.create(activity);
  } catch (err: any) {
    Log.error(err.message, {
      stack: err.stack,
    });
  }
}
