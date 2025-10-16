import { router } from "@/server/api/core/trpc";
import { grantApplicationRouter } from "./grant-application";

export const grantModuleRouter = router({
  grantApplication: grantApplicationRouter,
});

