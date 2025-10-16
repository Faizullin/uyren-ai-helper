import { Log } from "@/lib/logger";
import { generateEmailFrom } from "@/lib/utils";
import { addMailJob } from "@/server/lib/queue";
import {
  ApprovalStatusEnum,
  CohortJoinRequestModel,
  CourseEnrollmentMemberTypeEnum,
  CourseModel,
  EnrollmentModel,
  InvoiceModel,
  UserModel
} from "@workspace/common-logic";
import pug from "pug";
import invoiceMembershipTemplate from "./templates/invoice-membership";

interface SendInvoiceMembershipEmailParams {
  membershipId: string;
  invoiceId?: string;
  cohortJoinRequestId?: string;
  domain: {
    name: string;
    email: string;
    settings?: {
      hideCourseLitBranding?: boolean;
    };
  };
  headers: {
    host: string;
  };
  eventType?: string; // Add event type to determine email content
}

interface EmailData {
  emailTitle: string;
  emailMessage: string;
  courseTitle: string;
  courseLevel: string;
  creatorName: string;
  membershipId: string;
  membershipStatus: string;
  membershipRole: string;
  membershipDate: string;
  invoiceInfo?: boolean;
  invoiceId?: string;
  amount?: number;
  invoiceStatus?: string;
  paymentMethod?: string;
  invoiceDate?: string;
  currencySymbol: string;
  loginLink: string;
  userName: string;
  userEmail: string;
  currentDate: string;
  hideCourseLitBranding: boolean;
  eventType?: string;
}

export async function sendInvoiceMembershipEmail({
  membershipId,
  invoiceId,
  cohortJoinRequestId,
  domain,
  headers,
  eventType,
}: SendInvoiceMembershipEmailParams) {
  try {
    const enrollment = await EnrollmentModel.findById(membershipId).lean();
    if (!enrollment) {
      throw new Error(`Membership not found: ${membershipId}`);
    }

    const user = await UserModel.findById(enrollment.userId).lean();
    if (!user) {
      throw new Error(`User not found: ${enrollment.userId}`);
    }

    // Get course details
    const course = await CourseModel.findById(enrollment.courseId).lean();
    if (!course) {
      throw new Error(`Course not found: ${enrollment.courseId}`);
    }

    // Get invoice details if provided
    let invoice = null;
    if (invoiceId) {
      invoice = await InvoiceModel.findById(invoiceId).lean();
      if (!invoice) {
        Log.info(`Invoice not found: ${invoiceId}`);
      }
    }

    // Get cohort join request if provided
    let cohortJoinRequest = null;
    if (cohortJoinRequestId) {
      cohortJoinRequest = await CohortJoinRequestModel.findById(cohortJoinRequestId).lean();
      if (!cohortJoinRequest) {
        Log.info(`Cohort join request not found: ${cohortJoinRequestId}`);
      }
    }

    // Determine email content based on event type and membership status
    let emailTitle = "";
    let emailMessage = "";

    // Check if this is a checkout session expired event
    if (eventType && eventType === "checkout.session.expired") {
      emailTitle = "Payment Session Expired";
      emailMessage = `Your payment session for "${course.title}" has expired. To complete your enrollment, please initiate a new payment session.`;
    } else {
      // Handle based on enrollment member type and cohort join request
      if (cohortJoinRequest) {
        switch (cohortJoinRequest.status) {
          case ApprovalStatusEnum.APPROVED:
            emailTitle = "Cohort Join Request Approved";
            emailMessage = `Your request to join the cohort for "${course.title}" has been approved. You now have access to the cohort activities.`;
            break;
          case ApprovalStatusEnum.PENDING:
            emailTitle = "Cohort Join Request Pending";
            emailMessage = `Your request to join the cohort for "${course.title}" has been received and is currently under review. We'll notify you once it's approved.`;
            break;
          case ApprovalStatusEnum.REJECTED:
            emailTitle = "Cohort Join Request Update";
            emailMessage = `Your request to join the cohort for "${course.title}" could not be approved at this time. Please contact support for more information.`;
            break;
          default:
            emailTitle = "Cohort Join Request Update";
            emailMessage = `There has been an update to your cohort join request for "${course.title}".`;
        }
      } else {
        // Handle based on enrollment member type
        switch (enrollment.memberType) {
          case CourseEnrollmentMemberTypeEnum.STUDENT:
            emailTitle = "Welcome to Your Course!";
            emailMessage = `Congratulations! Your enrollment in "${course.title}" has been approved and you now have full access to the course content.`;
            break;
          case CourseEnrollmentMemberTypeEnum.MENTOR:
            emailTitle = "Mentor Access Granted";
            emailMessage = `You have been granted mentor access to "${course.title}". You can now help guide students through the course content.`;
            break;
          case CourseEnrollmentMemberTypeEnum.STAFF:
            emailTitle = "Staff Access Granted";
            emailMessage = `You have been granted staff access to "${course.title}". You can now manage and support the course.`;
            break;
          default:
            emailTitle = "Course Enrollment Update";
            emailMessage = `There has been an update to your enrollment in "${course.title}".`;
        }
      }
    }

    // Prepare email data
    const emailData: EmailData = {
      emailTitle,
      emailMessage,
      courseTitle: course.title,
      courseLevel: course.level,
      creatorName: course.instructors[0]?.fullName || "Unknown",
      membershipId: enrollment._id.toString(),
      membershipStatus: enrollment.memberType,
      membershipRole: enrollment.role,
      membershipDate: new Date().toLocaleDateString(),
      currencySymbol: "$", // Default currency symbol
      loginLink:
        eventType === "checkout.session.expired"
          ? `${headers.host}/checkout?type=course&id=${enrollment.courseId}`
          : `${headers.host}/login`,
      userName: user.fullName || user.userName || user.email,
      userEmail: user.email,
      currentDate: new Date().toLocaleDateString(),
      hideCourseLitBranding: domain.settings?.hideCourseLitBranding || false,
      eventType,
    };

    // Add invoice information if available
    if (invoice) {
      emailData.invoiceInfo = true;
      emailData.invoiceId = invoice._id.toString();
      emailData.amount = invoice.amount;
      emailData.invoiceStatus = invoice.status;
      emailData.paymentMethod = invoice.paymentMethod;
      emailData.invoiceDate = new Date().toLocaleDateString();

      // Update currency symbol based on invoice
      emailData.currencySymbol = getCurrencySymbol(invoice.currency);
    }

    // Render email template
    const emailBody = pug.render(invoiceMembershipTemplate, emailData);

    // Send email
    await addMailJob({
      to: [user.email],
      subject: emailTitle,
      body: emailBody,
      from: generateEmailFrom({
        name: domain.name,
        email: process.env.EMAIL_FROM || domain.email,
      }),
    });

    Log.info(`Invoice/Membership email sent successfully`, {
      membershipId,
      invoiceId,
      userEmail: user.email,
      courseTitle: course.title,
    });

    return true;
  } catch (error) {
    Log.error("Error sending invoice/membership email", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      membershipId,
      invoiceId: invoiceId || undefined,
    } as any);
    throw error;
  }
}

// Helper function to get currency symbol
function getCurrencySymbol(currencyISOCode: string): string {
  const currencySymbols: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
    JPY: "¥",
    INR: "₹",
    CNY: "¥",
    BRL: "R$",
    MXN: "$",
    KRW: "₩",
    RUB: "₽",
    ZAR: "R",
    SEK: "kr",
    NOK: "kr",
    DKK: "kr",
    CHF: "CHF",
    PLN: "zł",
    CZK: "Kč",
    HUF: "Ft",
  };

  return currencySymbols[currencyISOCode.toUpperCase()] || currencyISOCode;
}

// Convenience functions for different email types
export async function sendMembershipApprovalEmail(
  membershipId: string,
  domain: any,
  headers: any,
  cohortJoinRequestId?: string,
) {
  return sendInvoiceMembershipEmail({
    membershipId,
    cohortJoinRequestId,
    domain,
    headers,
  });
}

export async function sendMembershipPendingEmail(
  membershipId: string,
  domain: any,
  headers: any,
  cohortJoinRequestId?: string,
) {
  return sendInvoiceMembershipEmail({
    membershipId,
    cohortJoinRequestId,
    domain,
    headers,
  });
}

export async function sendMembershipRejectionEmail(
  membershipId: string,
  domain: any,
  headers: any,
  cohortJoinRequestId?: string,
) {
  return sendInvoiceMembershipEmail({
    membershipId,
    cohortJoinRequestId,
    domain,
    headers,
  });
}

export async function sendInvoicePaidEmail(
  membershipId: string,
  invoiceId: string,
  domain: any,
  headers: any,
) {
  return sendInvoiceMembershipEmail({
    membershipId,
    invoiceId,
    domain,
    headers,
  });
}

export async function sendInvoiceFailedEmail(
  membershipId: string,
  invoiceId: string,
  domain: any,
  headers: any,
) {
  return sendInvoiceMembershipEmail({
    membershipId,
    invoiceId,
    domain,
    headers,
  });
}

// New convenience function for payment expiration
export async function sendPaymentExpirationEmail(
  membershipId: string,
  invoiceId: string,
  domain: any,
  headers: any,
) {
  return sendInvoiceMembershipEmail({
    membershipId,
    invoiceId,
    domain,
    headers,
    eventType: "checkout.session.expired",
  });
}

// New convenience function for cohort join request emails
export async function sendCohortJoinRequestEmail(
  membershipId: string,
  cohortJoinRequestId: string,
  domain: any,
  headers: any,
) {
  return sendInvoiceMembershipEmail({
    membershipId,
    cohortJoinRequestId,
    domain,
    headers,
  });
}
