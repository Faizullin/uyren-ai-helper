import { router } from "@/server/api/core/trpc";
import { cohortRouter } from "./cohort";
import { joinRequestRouter } from "./join-request";

export const cohortModuleRouter = router({
  cohort: cohortRouter,
  joinRequest: joinRequestRouter,
});

