import { router } from "@/server/api/core/trpc";
import { mediaRouter } from "./media";

export const mediaModuleRouter = router({
  media: mediaRouter,
});
