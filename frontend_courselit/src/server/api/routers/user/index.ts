import { router } from "@/server/api/core/trpc";
import { notificationRouter } from "./notification";
import { userRouter } from "./user";

export const userModuleRouter = router({
  user: userRouter,
  notification: notificationRouter,
});
