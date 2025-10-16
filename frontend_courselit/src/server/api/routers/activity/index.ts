import { router } from "@/server/api/core/trpc";
import { activityRouter } from "./activity";

export const activityModuleRouter = router({
  activity: activityRouter,
});
