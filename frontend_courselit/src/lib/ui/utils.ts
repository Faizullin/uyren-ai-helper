import { getBackendAddress } from "@/server/lib/domain-utils";
import { IPaymentPlan, PaymentPlanTypeEnum } from "@workspace/common-logic/models/payment/payment-plan.types";

export const formattedLocaleDate = (
  epochString?: Date | number | string,
  monthFormat?: "short" | "long",
) => {
  if (epochString) {
    return new Date(Number(epochString)).toLocaleString("en-US", {
      year: "numeric",
      month: monthFormat || "short",
      day: "numeric",
    });
  }
  return "";
};


export function getPlanPrice(plan: IPaymentPlan): {
  amount: number;
  period: string;
} {
  if (!plan) {
    return { amount: 0, period: "" };
  }
  switch (plan.type) {
    case PaymentPlanTypeEnum.FREE:
      return { amount: 0, period: "" };
    case PaymentPlanTypeEnum.ONE_TIME:
      return { amount: plan.oneTimeAmount || 0, period: "" };
    case PaymentPlanTypeEnum.SUBSCRIPTION:
      if (plan.subscriptionYearlyAmount) {
        return {
          amount: plan.subscriptionYearlyAmount,
          period: "/yr",
        };
      }
      return {
        amount: plan.subscriptionMonthlyAmount || 0,
        period: "/mo",
      };
    case PaymentPlanTypeEnum.EMI:
      return {
        amount: plan.emiAmount || 0,
        period: "/mo",
      };
    default:
      return { amount: 0, period: "" };
  }
}

