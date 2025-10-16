"use server";

import { authOptions } from "@/lib/auth/options";
import { AuthenticationException, NotFoundException, ValidationException } from "@/server/api/core/exceptions";
import { getDomainData } from "@/server/lib/domain";
import { ApprovalStatusEnum } from "@workspace/common-logic/lib/approval_status";
import { connectToDatabase } from "@workspace/common-logic/lib/db";
import {
  GrantApplicationModel,
} from "@workspace/common-logic/models/lms/grant-application.model";
import { AidTypeEnum, EducationStatusEnum, IntendedTrackEnum } from "@workspace/common-logic/models/lms/grant-application.types";
import { IUserHydratedDocument, UserModel } from "@workspace/common-logic/models/user.model";
import { getServerSession } from "next-auth";

const submissionTracker = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
const MAX_SUBMISSIONS_PER_HOUR = 3;

function cleanupRateLimit() {
  const now = Date.now();
  for (const [key, timestamp] of submissionTracker.entries()) {
    if (now - timestamp > RATE_LIMIT_WINDOW) {
      submissionTracker.delete(key);
    }
  }
}

function checkRateLimit(identifier: string): boolean {
  cleanupRateLimit();
  const now = Date.now();
  const recentSubmissions = Array.from(submissionTracker.entries()).filter(
    ([key, timestamp]) =>
      key.startsWith(identifier) && now - timestamp < RATE_LIMIT_WINDOW
  );
  return recentSubmissions.length < MAX_SUBMISSIONS_PER_HOUR;
}

function recordSubmission(identifier: string) {
  const key = `${identifier}_${Date.now()}`;
  submissionTracker.set(key, Date.now());
}

async function getActionContext() {
  const session = await getServerSession(authOptions);
  const domainData = await getDomainData();

  if (!domainData.domainObj) {
    throw new NotFoundException("Domain");
  }

  let user: IUserHydratedDocument | null = null;
  if (session?.user) {
    user = await UserModel.findById(session.user.id).lean() as IUserHydratedDocument;
  }

  return {
    session: session || null,
    user: user || null,
    domainData,
  };
}

interface GrantApplicationData {
  fullName: string;
  email: string;
  phone: string;
  educationStatus: EducationStatusEnum;
  intendedTrack: IntendedTrackEnum;
  aidType: AidTypeEnum;
  motivation: string;
  consent: boolean;
}

export async function submitGrantApplication(data: GrantApplicationData): Promise<{
  success: boolean;
  message: string;
  applicationId?: string;
}> {
  try {
    await connectToDatabase();
    const ctx = await getActionContext();

    if (!ctx.domainData?.domainObj) {
      throw new NotFoundException("Domain not found");
    }

    const rateLimitKey = ctx.user?._id?.toString() || data.email;
    if (!checkRateLimit(rateLimitKey)) {
      throw new ValidationException(
        "Too many submissions. Please try again later."
      );
    }

    if (!data.fullName?.trim()) {
      throw new ValidationException("Full name is required");
    }

    if (!data.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      throw new ValidationException("Valid email is required");
    }

    if (!data.phone?.trim()) {
      throw new ValidationException("Phone number is required");
    }

    if (!data.educationStatus) {
      throw new ValidationException("Education status is required");
    }

    if (!data.intendedTrack) {
      throw new ValidationException("Intended track is required");
    }

    if (!data.aidType) {
      throw new ValidationException("Aid type is required");
    }

    if (!data.motivation?.trim()) {
      throw new ValidationException("Motivation statement is required");
    }

    if (data.motivation.length < 100) {
      throw new ValidationException(
        "Motivation statement must be at least 100 characters"
      );
    }

    if (data.motivation.length > 1000) {
      throw new ValidationException(
        "Motivation statement must not exceed 1000 characters"
      );
    }

    if (!data.consent) {
      throw new ValidationException(
        "You must agree to the privacy policy"
      );
    }

    const existingApplication = await GrantApplicationModel.findOne({
      email: data.email.toLowerCase(),
      orgId: ctx.domainData.domainObj.orgId,
      approvalStatus: ApprovalStatusEnum.PENDING,
    });

    if (existingApplication) {
      throw new ValidationException(
        "You already have a pending application. Please wait for review."
      );
    }

    const application = await GrantApplicationModel.create({
      orgId: ctx.domainData.domainObj.orgId,
      userId: ctx.user?._id,
      fullName: data.fullName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      educationStatus: data.educationStatus,
      intendedTrack: data.intendedTrack,
      aidType: data.aidType,
      motivation: data.motivation.trim(),
      consent: data.consent,
      approvalStatus: ApprovalStatusEnum.PENDING,
    });

    recordSubmission(rateLimitKey);

    return {
      success: true,
      message: "Grant application submitted successfully",
      applicationId: application._id.toString(),
    };
  } catch (error: any) {
    if (
      error instanceof ValidationException ||
      error instanceof AuthenticationException ||
      error instanceof NotFoundException
    ) {
      return {
        success: false,
        message: error.message,
      };
    }

    console.error("Grant application submission error:", error);
    return {
      success: false,
      message: "Failed to submit grant application. Please try again.",
    };
  }
}

export async function getMyApplications(): Promise<{
  success: boolean;
  applications?: any[];
  message?: string;
}> {
  try {
    await connectToDatabase();
    const ctx = await getActionContext();

    if (!ctx.user) {
      throw new AuthenticationException("Please sign in to view your applications");
    }

    if (!ctx.domainData?.domainObj) {
      throw new NotFoundException("Domain not found");
    }

    const applications = await GrantApplicationModel.find({
      userId: ctx.user._id,
      orgId: ctx.domainData.domainObj.orgId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return {
      success: true,
      applications: applications.map((app) => ({
        _id: app._id.toString(),
        fullName: app.fullName,
        email: app.email,
        educationStatus: app.educationStatus,
        intendedTrack: app.intendedTrack,
        aidType: app.aidType,
        approvalStatus: app.approvalStatus,
        createdAt: app.createdAt,
        reviewedAt: app.reviewedAt,
        reviewedNotes: app.reviewedNotes,
      })),
    };
  } catch (error: any) {
    if (
      error instanceof ValidationException ||
      error instanceof AuthenticationException ||
      error instanceof NotFoundException
    ) {
      return {
        success: false,
        message: error.message,
      };
    }

    console.error("Get applications error:", error);
    return {
      success: false,
      message: "Failed to load applications",
    };
  }
}

