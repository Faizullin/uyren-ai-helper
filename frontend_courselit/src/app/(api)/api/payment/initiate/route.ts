import { authOptions } from "@/lib/auth/options";
import { getDomainData } from "@/server/lib/domain";
import { Log } from "@/lib/logger";
import { getPaymentMethodFromSettings } from "@/server/services/payment";
import { generateUniqueId } from "@workspace/utils";
import { getServerSession } from "next-auth";
import { NextRequest } from "next/server";
import { activateMembership, getEntity, getPaymentPlan, getUser } from "../helpers";
import { DomainModel } from "@workspace/common-logic/models/organization.model";
import { PaymentPlanTypeEnum } from "@workspace/common-logic/models/payment/payment-plan.types";

  
export interface PaymentInitiateRequest {
  id: string;
  type: MembershipEntityTypeEnum;
  planId: string;
  origin: string;
  joiningReason?: string;
}

export async function POST(req: NextRequest) {
  const body: PaymentInitiateRequest = await req.json();

  try {
    const domainData = await getDomainData();
    if (!domainData.domainObj) {
      return Response.json({ message: "Domain not found" }, { status: 404 });
    }
    const domain = await DomainModel.findById(domainData.domainObj._id);
    if (!domain) {
      return Response.json({ message: "Domain not found" }, { status: 404 });
    }

    const session = await getServerSession(authOptions);
    const user = await getUser(session, domain._id);

    if (!user) {
      return Response.json({}, { status: 401 });
    }

    const { id, type, planId, origin, joiningReason } = body;

    if (!id || !type || !planId) {
      return Response.json({ message: "Bad request" }, { status: 400 });
    }

    const entity = await getEntity(type, id, domain._id);
    if (!entity) {
      return Response.json(
        { message: "Item not found" },
        { status: 404 },
      );
    }

    if (!(entity.paymentPlans as unknown as string[]).includes(planId)) {
      return Response.json(
        { message: "Invalid payment plan" },
        { status: 404 },
      );
    }

    const paymentPlan = await getPaymentPlan(domain._id, planId);
    if (!paymentPlan) {
      return Response.json(
        { message: "Invalid payment plan" },
        { status: 400 },
      );
    }

    const siteinfo = domain.siteInfo;
    const paymentMethod = await getPaymentMethodFromSettings(siteinfo);

    if (!paymentMethod && paymentPlan.type !== PaymentPlanTypeEnum.FREE) {
      return Response.json(
        {
          status: "failed",
          error: "Payment invalid settings",
        },
        { status: 500 },
      );
    }

    const membership = await getMembership({
      domainId: domain._id,
      userId: user.userId,
      entityType: type,
      entityId: id,
      planId,
    });

    // Check for existing membership status and prevent multiple payments
    if (membership.status === MembershipStatusEnum.REJECTED) {
      return Response.json({
        status: transactionFailed,
        error:
          "Your previous enrollment request was rejected. Please contact support for assistance.",
      });
    }

    if (membership.status === Constants.MembershipStatus.PENDING) {
      return Response.json({
        status: transactionFailed,
        error:
          "You already have a pending payment for this course. Please complete your existing payment or contact support if you need assistance.",
      });
    }

    if (membership.status === Constants.MembershipStatus.ACTIVE) {
      if (paymentPlan.type === Constants.PaymentPlanType.FREE) {
        return Response.json({ status: transactionSuccess });
      }
      if (
        membership.subscriptionId &&
        (paymentPlan.type === Constants.PaymentPlanType.EMI ||
          paymentPlan.type === Constants.PaymentPlanType.SUBSCRIPTION)
      ) {
        if (
          await paymentMethod?.validateSubscription(membership.subscriptionId)
        ) {
          return Response.json({ status: transactionSuccess });
        } else {
          membership.status = Constants.MembershipStatus.EXPIRED;
          await membership.save();
        }
      } else if (paymentPlan.type === Constants.PaymentPlanType.ONE_TIME) {
        return Response.json({
          status: transactionFailed,
          error: "You are already enrolled in this course.",
        });
      }
    }

    if (paymentPlan.type === Constants.PaymentPlanType.FREE) {
      // Check if user is already enrolled for free courses
      if (membership.status === Constants.MembershipStatus.ACTIVE) {
        return Response.json({
          status: transactionFailed,
          error: "You are already enrolled in this course.",
        });
      }

      if (
        type === Constants.MembershipEntityType.COMMUNITY &&
        !(entity as Community).autoAcceptMembers
      ) {
        if (!joiningReason) {
          return Response.json(
            {
              status: transactionFailed,
              error: responses.joining_reason_missing,
            },
            { status: 400 },
          );
        } else {
          membership.joiningReason = joiningReason;
        }
      }

      await activateMembership(domain, membership, paymentPlan);

      return Response.json({
        status: transactionSuccess,
      });
    }

    // Check if there's already a pending or active membership for this user and course
    const existingMembership = await MembershipModel.findOne({
      domain: domain._id,
      userId: user.userId,
      entityType: type,
      entityId: id,
      status: {
        $in: [
          Constants.MembershipStatus.PENDING,
          Constants.MembershipStatus.ACTIVE,
        ],
      },
    });

    if (
      existingMembership &&
      existingMembership.membershipId !== membership.membershipId
    ) {
      if (existingMembership.status === Constants.MembershipStatus.PENDING) {
        return Response.json({
          status: transactionFailed,
          error:
            "You already have a pending payment for this course. Please complete your existing payment or contact support if you need assistance.",
        });
      } else if (
        existingMembership.status === Constants.MembershipStatus.ACTIVE
      ) {
        return Response.json({
          status: transactionFailed,
          error: "You are already enrolled in this course.",
        });
      }
    }

    membership.paymentPlanId = planId;
    membership.status = Constants.MembershipStatus.PENDING;
    membership.sessionId = generateUniqueId();

    const invoiceId = generateUniqueId();
    const currencyISOCode = await paymentMethod?.getCurrencyISOCode();

    const metadata = {
      membershipId: membership.membershipId,
      invoiceId,
      currencyISOCode,
      domainId: domain._id.toString(),
    };

    const paymentTracker = await paymentMethod!.initiate({
      metadata,
      paymentPlan,
      product: {
        id: id,
        title:
          type === Constants.MembershipEntityType.COMMUNITY
            ? (entity as Community)!.name
            : (entity as Course)!.title,
        type,
      },
      origin,
    });

    await InvoiceModel.create({
      domain: domain._id,
      invoiceId,
      membershipId: membership.membershipId,
      membershipSessionId: membership.sessionId,
      amount:
        paymentPlan.oneTimeAmount ||
        paymentPlan.subscriptionMonthlyAmount ||
        paymentPlan.subscriptionYearlyAmount ||
        paymentPlan.emiAmount ||
        0,
      status: Constants.InvoiceStatus.PENDING,
      paymentProcessor: paymentMethod!.name,
      paymentProcessorEntityId: paymentTracker,
      currencyISOCode,
    });

    membership.subscriptionId = undefined;
    membership.subscriptionMethod = undefined;
    await (membership as any).save();

    return Response.json({
      status: transactionInitiated,
      paymentTracker,
      metadata,
    });
  } catch (err: any) {
    Log.error(`Error initiating payment: ${err.message}`, {
      body,
      stack: err.stack,
    });
    return Response.json(
      { status: transactionFailed, error: err.message },
      { status: 500 },
    );
  }
}
