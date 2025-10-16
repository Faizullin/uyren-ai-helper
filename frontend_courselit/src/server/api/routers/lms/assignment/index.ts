import { router } from "@/server/api/core/trpc";
import { assignmentRouter } from "./assignment";
import { assignmentSubmissionRouter } from "./assignment-submission";

export const assignmentModuleRouter = router({
  assignment: assignmentRouter,
  assignmentSubmission: assignmentSubmissionRouter,
});
