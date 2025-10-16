import { router } from "@/server/api/core/trpc";
import { reviewRouter } from "./review";

export const reviewModuleRouter = router({
  review: reviewRouter,
});
