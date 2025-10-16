import { createTRPCContext, router, t } from "./core/trpc";
import { activityModuleRouter } from "./routers/activity";
import { chatModuleRouter } from "./routers/chat";
import { lmsModuleRouter } from "./routers/lms";
import { mediaModuleRouter } from "./routers/media";
import { paymentModuleRouter } from "./routers/payment";
import { siteModuleRouter } from "./routers/site";
import { userModuleRouter } from "./routers/user";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = router({
  userModule: userModuleRouter,
  siteModule: siteModuleRouter,
  lmsModule: lmsModuleRouter,
  activityModule: activityModuleRouter,
  mediaModule: mediaModuleRouter,
  paymentModule: paymentModuleRouter,
  chatModule: chatModuleRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

const createCaller = t.createCallerFactory(appRouter);

export const trpcCaller = createCaller(createTRPCContext);
