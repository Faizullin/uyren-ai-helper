import { ActivityModel } from "@workspace/common-logic/models/activity.model";
import { IActivity } from "@workspace/common-logic/models/activity.types";
import { Log } from "../logger";

export async function recordActivity(activity: IActivity) {
  try {
    // const existingActivity = await ActivityModel.findOne({
    //   orgId: activity.orgId,
    //   userId: activity.userId,
    //   actor: activity.actor,
    //   type: activity.type,
    // });

    // if (existingActivity) {
    //   return;
    // }

    await ActivityModel.create(activity);
  } catch (err: any) {
    Log.error(err.message, {
      stack: err.stack,
    });
  }
}
