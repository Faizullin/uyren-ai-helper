import { router } from "@/server/api/core/trpc";
import { themeRouter } from "./theme";

export const themeModuleRouter = router({
  theme: themeRouter,
});
