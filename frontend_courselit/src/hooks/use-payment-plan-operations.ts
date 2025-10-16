import { trpc } from "@/utils/trpc";
import type {
  MembershipEntityType,
  PaymentPlan,
} from "@workspace/common-models";
import { useState } from "react";

interface UsePaymentPlanOperationsProps {
  id: string;
  entityType: MembershipEntityType;
}

export function usePaymentPlanOperations({
  id,
  entityType,
}: UsePaymentPlanOperationsProps) {
  const [paymentPlans, setPaymentPlans] = useState<PaymentPlan[]>([]);
  const [defaultPaymentPlan, setDefaultPaymentPlan] = useState<string>();

  const createPaymentPlanMutation =
    trpc.paymentModule.paymentPlan.create.useMutation();
  const archivePaymentPlanMutation =
    trpc.paymentModule.paymentPlan.archive.useMutation();
  const changeDefaultPlanMutation =
    trpc.paymentModule.paymentPlan.changeDefaultPlan.useMutation();

  const onPlanSubmitted = async (plan: any) => {
    // const query = `
    //     mutation CreatePlan(
    //         $name: String!
    //         $type: PaymentPlanType!
    //         $entityId: String!
    //         $entityType: MembershipEntityType!
    //         $oneTimeAmount: Int
    //         $emiAmount: Int
    //         $emiTotalInstallments: Int
    //         $subscriptionMonthlyAmount: Int
    //         $subscriptionYearlyAmount: Int
    //     ) {
    //         plan: createPlan(
    //             name: $name
    //             type: $type
    //             entityId: $entityId
    //             entityType: $entityType
    //             oneTimeAmount: $oneTimeAmount
    //             emiAmount: $emiAmount
    //             emiTotalInstallments: $emiTotalInstallments
    //             subscriptionMonthlyAmount: $subscriptionMonthlyAmount
    //             subscriptionYearlyAmount: $subscriptionYearlyAmount
    //         ) {
    //             planId
    //             name
    //             type
    //             oneTimeAmount
    //             emiAmount
    //             emiTotalInstallments
    //             subscriptionMonthlyAmount
    //             subscriptionYearlyAmount
    //         }
    //     }
    // `;

    const submitData = {
      ...plan,
      entityId: id,
      entityType: entityType,
    };
    const response = await createPaymentPlanMutation.mutateAsync({
      data: submitData,
    });
    setPaymentPlans([...paymentPlans, response]);
    return response;
  };

  const onPlanArchived = async (planId: string) => {
    // const query = `
    //     mutation ArchivePlan($planId: String!, $entityId: String!, $entityType: MembershipEntityType!) {
    //         plan: archivePlan(planId: $planId, entityId: $entityId, entityType: $entityType) {
    //             planId
    //             name
    //             type
    //             oneTimeAmount
    //             emiAmount
    //             emiTotalInstallments
    //             subscriptionMonthlyAmount
    //             subscriptionYearlyAmount
    //         }
    //     }
    // `;
    const submitData = {
      planId,
      entityId: id,
      entityType: entityType,
    };

    const response = await archivePaymentPlanMutation.mutateAsync({
      data: submitData,
    });
    setPaymentPlans(paymentPlans.filter((p) => p.planId !== planId));
    return response;
  };

  const onDefaultPlanChanged = async (planId: string) => {
    // const query = `
    //     mutation ChangeDefaultPlan($planId: String!, $entityId: String!, $entityType: MembershipEntityType!) {
    //         plan: changeDefaultPlan(planId: $planId, entityId: $entityId, entityType: $entityType) {
    //             planId
    //         }
    //     }
    // `;

    const response = await changeDefaultPlanMutation.mutateAsync({
      data: {
        planId,
        entityId: id,
        entityType,
      },
    });
    if (response) {
      setDefaultPaymentPlan(response.planId);
    }
    return response;
  };

  return {
    paymentPlans,
    setPaymentPlans,
    defaultPaymentPlan,
    setDefaultPaymentPlan,
    onPlanSubmitted,
    onPlanArchived,
    onDefaultPlanChanged,
  };
}
