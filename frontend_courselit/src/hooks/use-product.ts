import { TOAST_TITLE_ERROR } from "@/lib/ui/config/strings";
import { GeneralRouterOutputs } from "@/server/api/types";
import { trpc } from "@/utils/trpc";
import { useToast } from "@workspace/components-library";
import { useEffect, useState } from "react";

type ProductWithAdminProps =
  GeneralRouterOutputs["lmsModule"]["courseModule"]["course"]["getByCourseDetailed"];

export default function useProduct(id: string): {
  product: ProductWithAdminProps | undefined | null;
  loaded: boolean;
} {
  const { toast } = useToast();

  const loadQuery =
    trpc.lmsModule.courseModule.course.getByCourseDetailed.useQuery({
      courseId: id,
    });

  useEffect(() => {
    if (loadQuery.error) {
      toast({
        title: TOAST_TITLE_ERROR,
        description: loadQuery.error.message,
        variant: "destructive",
      });
    }
  }, [loadQuery.error]);

  //     const query = `
  //     query {
  //         course: getCourse(id: "${courseId}") {
  //             title,
  //             description,
  //             type,
  //             slug,
  //             lessons {
  //                 id,
  //                 title,
  //                 groupId,
  //                 lessonId,
  //                 type
  //             },
  //             groups {
  //                 id,
  //                 name,
  //                 rank,
  //                 lessonsOrder,
  //                 drip {
  //                     type,
  //                     status,
  //                     delayInMillis,
  //                     dateInUTC,
  //                     email {
  //                         content {
  //                             content {
  //                                 blockType,
  //                                 settings
  //                             },
  //                             style,
  //                             meta
  //                         },
  //                         subject
  //                         emailId
  //                     }
  //                 }
  //             },
  //             courseId,
  //             cost,
  //             costType,
  //             creatorName,
  //             featuredImage {
  //                 mediaId,
  //                 originalFileName,
  //                 mimeType,
  //                 size,
  //                 access,
  //                 file,
  //                 thumbnail,
  //                 caption
  //             },
  //             published,
  //             privacy,
  //             pageId,
  //             updatedAt
  //             paymentPlans {
  //                 planId
  //                 name
  //                 type
  //                 oneTimeAmount
  //                 emiAmount
  //                 emiTotalInstallments
  //                 subscriptionMonthlyAmount
  //                 subscriptionYearlyAmount
  //             }
  //             leadMagnet
  //             defaultPaymentPlan
  //         }
  //     }
  // `;

  return { product: loadQuery.data, loaded: !loadQuery.isLoading };
}
