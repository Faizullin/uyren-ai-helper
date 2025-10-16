"use server";

import { authOptions } from "@/lib/auth/options";
import { getDomainData } from "@/server/lib/domain";
import { connectToDatabase } from "@workspace/common-logic/lib/db";
import { PublicationStatusEnum } from "@workspace/common-logic/lib/publication_status";
import { AssignmentModel, AssignmentPeerReviewModel, AssignmentSubmissionModel } from "@workspace/common-logic/models/lms/assignment.model";
import { AssignmentSubmissionStatusEnum } from "@workspace/common-logic/models/lms/assignment.types";
import { UserModel } from "@workspace/common-logic/models/user.model";
import mongoose from "mongoose";
import { getServerSession } from "next-auth";
import { AuthenticationException, NotFoundException } from "../api/core/exceptions";
import { MainContextType } from "../api/core/procedures";


interface SubmissionData {
  content: string;
  attachments?: string[];
}
// Core functions
async function getActionContext(): Promise<MainContextType> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new AuthenticationException("User not authenticated");
  }

  const user = await UserModel.findById(session.user.id);
  if (!user) {
    throw new AuthenticationException("User not found");
  }

  const domainData = await getDomainData();
  if (!domainData.domainObj) {
    throw new NotFoundException("Domain");
  }

  return {
    user: user,
    session: session,
    domainData: {
      ...domainData,
      domainObj: domainData.domainObj!
    },
  } as MainContextType;
}

const validateAssignment = async (assignmentId: string, ctx: MainContextType) => {
  const assignment = await AssignmentModel.findOne({
    _id: assignmentId,
    orgId: ctx.domainData.domainObj.orgId
  });
  if (!assignment) {
    throw new Error("Assignment not found");
  }
  if (assignment.publicationStatus !== PublicationStatusEnum.PUBLISHED) {
    throw new Error("Assignment is not published");
  }
  if (
    assignment.dueDate &&
    new Date() > assignment.dueDate &&
    !assignment.allowLateSubmission
  ) {
    throw new Error(
      "Assignment is overdue and late submissions are not allowed",
    );
  }
  return assignment;
};

export async function createAssignmentSubmission(
  assignmentId: string,
  userId: mongoose.Types.ObjectId,
  data: SubmissionData,
): Promise<any> {
  const ctx = await getActionContext();
  const assignment = await validateAssignment(assignmentId, ctx);
  // Check existing submissions
  const existingSubmissions = await AssignmentSubmissionModel.countDocuments({
    assignmentId,
    userId,
    orgId: ctx.domainData.domainObj.orgId,
    status: { $in: ["submitted", "graded"] },
  });

  if (assignment.maxAttempts && existingSubmissions >= assignment.maxAttempts) {
    throw new Error("Maximum submissions reached");
  }

  const submission = await AssignmentSubmissionModel.create({
    orgId: ctx.domainData.domainObj.orgId,
    assignmentId,
    userId,
    status: AssignmentSubmissionStatusEnum.SUBMITTED,
    submittedAt: new Date(),
    content: data.content,
    attachments: data.attachments || [],
    attemptNumber: existingSubmissions + 1,
  });

  return submission;
}

export async function gradeAssignmentSubmission(
  submissionId: string,
  graderId: mongoose.Types.ObjectId,
  gradeData: {
    score: number;
    feedback?: string;
    rubricScores?: Array<{
      criterionId: mongoose.Types.ObjectId;
      score: number;
      feedback?: string;
    }>;
  },
): Promise<any> {
  const ctx = await getActionContext();

  const submission = await AssignmentSubmissionModel.findById(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  const assignment = await AssignmentModel.findById(submission.assignmentId);
  if (!assignment) {
    throw new Error("Assignment not found");
  }

  // Calculate percentage score
  const percentageScore =
    assignment.totalPoints > 0
      ? (gradeData.score / assignment.totalPoints) * 100
      : 0;

  // Apply late penalty if applicable
  let finalScore = gradeData.score;
  if (assignment.dueDate && submission.submittedAt > assignment.dueDate) {
    const latePenalty = Math.min(
      assignment.latePenalty || 0,
      gradeData.score * (assignment.latePenalty / 100),
    );
    finalScore = Math.max(0, gradeData.score - latePenalty);
  }

  const updatedSubmission = await AssignmentSubmissionModel.findByIdAndUpdate(
    submissionId,
    {
      status: AssignmentSubmissionStatusEnum.GRADED,
      score: finalScore,
      percentageScore: (finalScore / assignment.totalPoints) * 100,
      feedback: gradeData.feedback,
      gradedAt: new Date(),
      gradedById: graderId,
      latePenaltyApplied:
        finalScore < gradeData.score ? gradeData.score - finalScore : 0,
    },
    { new: true },
  );

  return updatedSubmission;
}

export async function addPeerReview(
  submissionId: string,
  reviewerId: mongoose.Types.ObjectId,
  reviewData: {
    score: number;
    feedback: string;
  },
): Promise<any> {
  const ctx = await getActionContext();

  const submission = await AssignmentSubmissionModel.findById(submissionId);
  if (!submission) {
    throw new Error("Submission not found");
  }

  const assignment = await AssignmentModel.findById(submission.assignmentId);
  if (!assignment || !assignment.allowPeerReview) {
    throw new Error("Peer review not enabled for this assignment");
  }

  const peerReview = await AssignmentPeerReviewModel.create({
    orgId: ctx.domainData.domainObj.orgId,
    submissionId: submission._id,
    reviewerId,
    score: reviewData.score,
    feedback: reviewData.feedback,
    reviewedAt: new Date(),
  });

  return peerReview;
}

export async function uploadFileAction(formData: FormData) {
  const ctx = await getActionContext();
  const file = formData.get("file") as File;

  if (!file) throw new Error("File is required");
  if (file.size > 15 * 1024 * 1024) throw new Error("File too large");

  const allowed = ["image/", "video/", "audio/", "application/pdf", "application/zip", "text/"];
  const ok = allowed.some(t => file.type.startsWith(t));
  if (!ok) throw new Error("Unsupported file type");

  const fd = new FormData();
  fd.append("file", file);
  fd.append("caption", file.name);
  fd.append("access", "private");

  const headersList = await (await import("next/headers")).headers();
  const proto = headersList.get("x-forwarded-proto") || "http";
  const host = headersList.get("host") || "localhost:3000";

  const res = await fetch(`${proto}://${host}/api/services/media/upload?storageType=cloudinary`, {
    method: "POST",
    body: fd,
  });

  if (!res.ok) throw new Error("Upload failed");
  const json = await res.json();
  const url = json?.url || json?.media?.url;
  if (!url) throw new Error("Upload response invalid");

  return { success: true, url };
}

export async function submitAssignmentAction(formData: FormData) {
  const ctx = await getActionContext();
  await connectToDatabase();

  const assignmentId = String(formData.get("assignmentId") || "");
  if (!assignmentId) throw new Error("assignmentId is required");

  const assignment = await validateAssignment(assignmentId, ctx);

  const content = String(formData.get("content") || "");
  const attachments = formData.getAll("attachments").filter(Boolean).map(String);


  const submission = await AssignmentSubmissionModel.create({
    orgId: ctx.domainData.domainObj.orgId,
    assignmentId: assignment._id,
    userId: ctx.user._id,
    status: AssignmentSubmissionStatusEnum.SUBMITTED,
    submittedAt: new Date(),
    content,
    attachments,
    attemptNumber: 1,
  });

  return { success: true, id: submission._id.toString() };
}
