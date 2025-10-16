import constants from "@/config/constants";
import { recordActivity } from "@/lib/models/record-activity";
import { getPlanPrice } from "@/lib/ui/utils";
import CommunityModel from "@/models/community/Community";
import CourseModel from "@/models/Course";
import { Domain } from "@/models/Domain";
import UserModel from "@/models/User";
import { InternalCourse } from "@workspace/common-logic";
import {
  Constants,
  Event,
  Membership,
  PaymentPlan,
  User,
} from "@workspace/common-models";
import { HydratedDocument } from "mongoose";

export async function activateMembership(
  domain: Domain,
  membership: HydratedDocument<Membership>,
  paymentPlan: PaymentPlan | null,
) {
  if (membership.status === Constants.MembershipStatus.ACTIVE) {
    return;
  }

  if (membership.entityType === Constants.MembershipEntityType.COMMUNITY) {
    if (paymentPlan?.type === Constants.PaymentPlanType.FREE) {
      const community = await CommunityModel.findOne({
        communityId: membership.entityId,
      });
      if (community) {
        membership.status = community.autoAcceptMembers
          ? Constants.MembershipStatus.ACTIVE
          : Constants.MembershipStatus.PENDING;
        ((membership.role = community.autoAcceptMembers
          ? Constants.MembershipRole.POST
          : Constants.MembershipRole.COMMENT),
          (membership.joiningReason = community.autoAcceptMembers
            ? `Auto accepted`
            : membership.joiningReason));
      }
    } else {
      membership.status = Constants.MembershipStatus.ACTIVE;
      membership.role = Constants.MembershipRole.POST;
    }
  } else {
    membership.status = Constants.MembershipStatus.ACTIVE;
  }

  await membership.save();

  if (paymentPlan) {
    await finalizePurchase({ domain, membership, paymentPlan });
  }
}

export async function finalizePurchase({
  domain,
  membership,
  paymentPlan,
}: {
  domain: Domain;
  membership: Membership;
  paymentPlan: PaymentPlan;
}) {
  const user = await UserModel.findOne({ userId: membership.userId });
  if (!user) {
    return;
  }

  let event: Event | undefined = undefined;
  if (paymentPlan.type !== Constants.PaymentPlanType.FREE) {
    await recordActivity({
      domain: domain._id,
      userId: user.userId,
      type: constants.activityTypes[1],
      entityId: membership.entityId,
      metadata: {
        cost: getPlanPrice(paymentPlan).amount,
        purchaseId: membership.sessionId,
      },
    });
  }
  if (membership.entityType === Constants.MembershipEntityType.COMMUNITY) {
    await recordActivity({
      domain: domain._id,
      userId: user.userId,
      type: constants.activityTypes[15],
      entityId: membership.entityId,
    });

    event = Constants.EventType.COMMUNITY_JOINED;
  }
  if (membership.entityType === Constants.MembershipEntityType.COURSE) {
    const product = await CourseModel.findOne({
      courseId: membership.entityId,
    });
    if (product) {
      await addProductToUser({
        user,
        product,
        // cost: getPlanPrice(paymentPlan).amount,
      });
    }
    await recordActivity({
      domain: domain._id,
      userId: user.userId,
      type: constants.activityTypes[0],
      entityId: membership.entityId,
    });

    event = Constants.EventType.PRODUCT_PURCHASED;
  }

  // if (event) {
  //   await triggerSequences({ user, event, data: membership.entityId });
  // }
}

async function addProductToUser({
  user,
  product,
}: {
  user: HydratedDocument<User>;
  product: InternalCourse;
}) {
  if (
    !user.purchases.some((purchase) => purchase.courseId === product.courseId)
  ) {
    user.purchases.push({
      courseId: product.courseId,
      completedLessons: [],
      accessibleGroups: [],
    });
    await user.save();
  }
}
