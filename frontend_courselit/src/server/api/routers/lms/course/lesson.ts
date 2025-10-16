import {
  AuthenticationException,
  AuthorizationException,
  NotFoundException
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  MainContextType,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import {
  documentIdValidator,
  mediaWrappedFieldValidator,
  textEditorContentValidator,
} from "@/server/api/core/validators";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import {
  CourseModel,
  ICourseHydratedDocument,
  } from "@workspace/common-logic/models/lms/course.model";
import { EnrollmentModel } from "@workspace/common-logic/models/lms/enrollment.model";
import { EnrollmentStatusEnum } from "@workspace/common-logic/models/lms/enrollment.types";
import {
  ILessonHydratedDocument,
  LessonModel,
} from "@workspace/common-logic/models/lms/lesson.model";
import { LessonTypeEnum } from "@workspace/common-logic/models/lms/lesson.types";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import mongoose, { RootFilterQuery } from "mongoose";
import { z } from "zod";
import { getCourseOrThrow } from "./helpers";

// TODO: Add lesson reordering within chapters (like Frappe LMS update_lesson_index)
// TODO: Add video watch duration tracking (like Frappe LMS track_video_watch_duration)
// TODO: Add lesson progress tracking with save_progress integration

const getLessonOrThrow = async (
  id: string,
  ctx: MainContextType,
) => {
  const lesson = await LessonModel.findOne({
    _id: id,
    orgId: ctx.domainData.domainObj.orgId,
  });

  if (!lesson) {
    throw new NotFoundException("Lesson", id);
  }

  if (!checkPermission(ctx.user.permissions, [UIConstants.permissions.manageAnyCourse])) {
    if (!lesson.ownerId.equals(ctx.user._id)) {
      if (!checkPermission(ctx.user.permissions, [UIConstants.permissions.manageCourse])) {
        throw new AuthorizationException();
      }
    }
  }

  return lesson;
};

export const lessonRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([
        UIConstants.permissions.manageCourse,
        UIConstants.permissions.manageAnyCourse,
      ]),
    )
    .input(ListInputSchema.extend({
      courseId: documentIdValidator().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof LessonModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (!checkPermission(ctx.user.permissions, [UIConstants.permissions.manageAnyCourse])) {
        query.ownerId = ctx.user._id;
      }

      if (input.courseId) {
        query.courseId = new mongoose.Types.ObjectId(input.courseId);
      }

      if (input.search?.q) {
        query.$text = { $search: input.search.q };
      }

      const paginationMeta = paginate(input.pagination);
      const orderBy = input.orderBy || {
        field: "createdAt",
        direction: "desc",
      };
      const sortObject: Record<string, 1 | -1> = {
        [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
      };

      const [items, total] = await Promise.all([
        LessonModel.find(query)
          .populate<{
            owner: Pick<IUserHydratedDocument, "username" | "firstName" | "lastName" | "fullName" | "email">;
          }>("owner", "username firstName lastName fullName email")
          .populate<{
            course: Pick<ICourseHydratedDocument, "title">;
          }>("course", "title")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? LessonModel.countDocuments(query)
          : Promise.resolve(null),
      ]);

      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const lesson = await LessonModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          owner: Pick<IUserHydratedDocument, "username" | "firstName" | "lastName" | "fullName" | "email">;
        }>("owner", "username firstName lastName fullName email")
        .populate<{
          course: Pick<ICourseHydratedDocument, "title">;
        }>("course", "title")
        .lean();

      if (!lesson) {
        throw new NotFoundException("Lesson", input.id);
      }

      return jsonify(lesson);
    }),

  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageCourse]))
    .input(
      getFormDataSchema({
        title: z.string().min(1).max(255),
        slug: z.string().optional(),
        content: textEditorContentValidator(),
        type: z.nativeEnum(LessonTypeEnum),
        downloadable: z.boolean().default(false),
        requiresEnrollment: z.boolean().default(true),
        published: z.boolean().default(false),
        media: mediaWrappedFieldValidator().optional(),
        courseId: documentIdValidator(),
        chapterId: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const course = await getCourseOrThrow({
        ctx,
        courseId: input.data.courseId,
      });

      // Verify chapter exists
      const chapter = course.chapters.find(
        (ch) => ch._id.toString() === input.data.chapterId,
      );
      if (!chapter) {
        throw new NotFoundException("Chapter", input.data.chapterId);
      }

      const { chapterId, ...lessonData } = input.data;

      const lesson = await LessonModel.create({
        ...lessonData,
        orgId: ctx.domainData.domainObj.orgId,
        ownerId: ctx.user._id,
      });

      // Add lesson to chapter's lessonOrderIds
      chapter.lessonOrderIds.push(lesson._id);
      await course.save();

      return jsonify(lesson.toObject());
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageCourse]))
    .input(
      getFormDataSchema({
        title: z.string().min(1).max(255).optional(),
        slug: z.string().optional(),
        content: textEditorContentValidator().optional(),
        type: z.nativeEnum(LessonTypeEnum).optional(),
        downloadable: z.boolean().optional(),
        requiresEnrollment: z.boolean().optional(),
        published: z.boolean().optional(),
        media: mediaWrappedFieldValidator().nullable().optional(),
      }, {
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lesson = await getLessonOrThrow(input.id, ctx);

      Object.keys(input.data).forEach((key) => {
        (lesson as any)[key] = (input.data as any)[key];
      });

      const savedLesson = await lesson.save();
      return jsonify(savedLesson.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageCourse]))
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const lesson = await getLessonOrThrow(input.id, ctx);

      // Find course and remove lesson from all chapters
      const course = await CourseModel.findOne({
        _id: lesson.courseId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!course) {
        throw new NotFoundException("Course", lesson.courseId.toString());
      }

      // Remove lesson from all chapters' lessonOrderIds
      course.chapters.forEach((chapter) => {
        chapter.lessonOrderIds = chapter.lessonOrderIds.filter(
          (id) => !id.equals(lesson._id),
        );
      });

      await course.save();

      await LessonModel.deleteOne({
        _id: lesson._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      return { success: true };
    }),

  publicGetById: publicProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        courseId: documentIdValidator(),
        lessonId: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const course = await CourseModel.findOne({
        _id: input.courseId,
        orgId: ctx.domainData.domainObj.orgId,
        published: true,
      });

      if (!course) {
        throw new NotFoundException("Course", input.courseId);
      }

      const lesson = await LessonModel.findOne({
        _id: input.lessonId,
        courseId: input.courseId,
        orgId: ctx.domainData.domainObj.orgId,
        published: true,
      }).lean();

      if (!lesson) {
        throw new NotFoundException("Lesson", input.lessonId);
      }

      // Check enrollment requirement
      if (lesson.requiresEnrollment) {
        if (!ctx.session?.user) {
          throw new AuthenticationException();
        }

        const enrollment = await EnrollmentModel.findOne({
          userId: ctx.session.user.id,
          courseId: lesson.courseId,
          orgId: ctx.domainData.domainObj.orgId,
        });

        if (!enrollment || enrollment.status !== EnrollmentStatusEnum.ACTIVE) {
          if (!checkPermission(ctx.session.user.permissions, [
            UIConstants.permissions.manageCourse,
            UIConstants.permissions.manageAnyCourse,
          ])
          ) {
            throw new AuthorizationException();
          }
        }
      }

      // Find prev/next lessons in the course structure
      let prevLesson: Pick<ILessonHydratedDocument, "_id" | "title"> | null = null;
      let nextLesson: Pick<ILessonHydratedDocument, "_id" | "title"> | null = null;

      // Get all lessons from all chapters in order
      const allLessonIds: mongoose.Types.ObjectId[] = [];
      course.chapters
        .sort((a, b) => a.order - b.order)
        .forEach((chapter) => {
          allLessonIds.push(...chapter.lessonOrderIds);
        });

      const currentIndex = allLessonIds.findIndex((id) =>
        id.equals(lesson._id),
      );

      if (currentIndex > 0) {
        const prevLessonDoc = await LessonModel.findOne({
          _id: allLessonIds[currentIndex - 1],
          published: true,
        })
          .select("_id title")
          .lean();
        if (prevLessonDoc) {
          prevLesson = prevLessonDoc;
        }
      }

      if (currentIndex < allLessonIds.length - 1) {
        const nextLessonDoc = await LessonModel.findOne({
          _id: allLessonIds[currentIndex + 1],
          published: true,
        })
          .select("_id title")
          .lean();
        if (nextLessonDoc) {
          nextLesson = nextLessonDoc;
        }
      }

      return jsonify({
        ...lesson,
        meta: {
          nextLesson,
          prevLesson,
        },
      });
    }),
});
