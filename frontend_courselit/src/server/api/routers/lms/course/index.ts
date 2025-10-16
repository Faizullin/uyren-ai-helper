import { router } from "@/server/api/core/trpc";
import { courseRouter } from "./course";
import { lessonRouter } from "./lesson";

export const courseModuleRouter = router({
  course: courseRouter,
  lesson: lessonRouter,
});
