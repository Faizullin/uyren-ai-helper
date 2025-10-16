import {
  AuthorizationException,
  NotFoundException
} from "@/server/api/core/exceptions";
import { MainContextType } from "@/server/api/core/procedures";
import { deleteMedia } from "@/server/services/media";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { CourseModel, ICourseHydratedDocument } from "@workspace/common-logic/models/lms/course.model";
import { LessonModel } from "@workspace/common-logic/models/lms/lesson.model";
import { checkPermission } from "@workspace/utils";
import mongoose from "mongoose";

export const deleteAllLessons = async (
  course: ICourseHydratedDocument,
  ctx: MainContextType,
) => {
  const allLessonsWithMedia = await LessonModel.find(
    {
      orgId: ctx.domainData.domainObj.orgId,
      courseId: course._id,
      media: { $ne: null },
    },
    {
      media: 1,
    },
  );
  for (let l of allLessonsWithMedia) {
    if (l.media) {
      await deleteMedia(l.media);
    }
  }
  await LessonModel.deleteMany({
    orgId: ctx.domainData.domainObj.orgId,
    courseId: course._id,
  });
};

export const getCourseOrThrow = async ({
  ctx,
  courseId,
}: {
  ctx: MainContextType,
  courseId?: mongoose.Types.ObjectId | string,
}) => {
  const course = await CourseModel.findOne({
    _id: courseId,
    orgId: ctx.domainData.domainObj.orgId
  });

  if (!course) {
    throw new NotFoundException("Course", courseId);
  }

  if (
    !checkPermission(ctx.user.permissions, [
      UIConstants.permissions.manageAnyCourse,
    ])
  ) {
    if (!course.ownerId.equals(ctx.user._id)) {
      throw new NotFoundException("Course", courseId);
    } else {
      if (
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageCourse,
        ])
      ) {
        throw new AuthorizationException();
      }
    }
  }

  return course;
};

export const syncCourseLessons = async ({
  ctx,
  course,
}: {
  ctx: MainContextType;
  course: ICourseHydratedDocument,
}) => {
  const existingLessons = await LessonModel.find({
    orgId: ctx.domainData.domainObj.orgId,
    courseId: course._id,
  });
  const existingLessonIds = existingLessons.map(lesson => lesson._id);
  for (const chapter of course.chapters) {
    // Remove lesson IDs that no longer exist
    chapter.lessonOrderIds = chapter.lessonOrderIds.filter(id =>
      existingLessonIds.some(lessonId => lessonId.equals(id))
    );
  }
  await course.save();
  return course;
};
