import mongoose from "mongoose";
import CommunityModel from "@/models/community/Community";
import CourseModel from "@/models/Course";
import PaymentPlanModel from "@/models/PaymentPlan";
import User from "@/models/User";
import { Community, Course, PaymentPlan, Constants, Membership, Domain } from "@workspace/common-models";
import { finalizePurchase } from "@/server/api/routers/payment/helpers";

export async function getUser(session: any, domainId: mongoose.Types.ObjectId) {
  if (!session) return null;
  return await User.findOne({
    email: session.user!.email,
    domain: domainId,
    active: true,
  });
}

export async function getEntity(
  type: string,
  id: string,
  domainId: mongoose.Types.ObjectId,
) {
  if (type === Constants.MembershipEntityType.COMMUNITY) {
    return await CommunityModel.findOne<Community>({
      communityId: id,
      domain: domainId,
      deleted: false,
    });
  } else if (type === Constants.MembershipEntityType.COURSE) {
    return await CourseModel.findOne<Course>({
      courseId: id,
      domain: domainId,
    });
  }
  return null;
}

export async function getPaymentPlan(
  domainId: mongoose.Types.ObjectId,
  planId: string,
) {
  return await PaymentPlanModel.findOne<PaymentPlan>({
    domain: domainId,
    planId,
    archived: false,
    internal: false,
  });
}

export async function activateMembership(
  domain: Domain & { _id: mongoose.Types.ObjectId },
  membership: Membership,
  paymentPlan: PaymentPlan | null,
) {
  if (membership.status === Constants.MembershipStatus.ACTIVE) {
    return;
  }

  if (membership.entityType === Constants.MembershipEntityType.COMMUNITY) {
    if (paymentPlan?.type === Constants.PaymentPlanType.FREE) {
      const community = await CommunityModel.findOne<Community>({
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

  await (membership as any).save();
  if (paymentPlan) {
    await finalizePurchase({ domain, membership, paymentPlan });
  }
}
