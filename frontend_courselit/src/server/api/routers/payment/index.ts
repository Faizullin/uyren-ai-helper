import { router } from "@/server/api/core/trpc";
import { invoiceRouter } from "./invoice";
import { paymentRouter } from "./payment";
import { paymentPlanRouter } from "./payment-plan";

export const paymentModuleRouter = router({
  invoice: invoiceRouter,
  payment: paymentRouter,
  paymentPlan: paymentPlanRouter,
});
