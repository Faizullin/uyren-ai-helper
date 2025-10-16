import {
  AuthorizationException,
  ConflictException,
  NotFoundException,
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  MainContextType,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/core/procedures";
import {
  getFormDataSchema,
  ListInputSchema
} from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import {
  documentIdValidator,
  mediaWrappedFieldValidator,
  textEditorContentValidator,
} from "@/server/api/core/validators";
import { deleteMedia } from "@/server/services/media";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import {
  CourseModel,
  ICourseHydratedDocument,
} from "@workspace/common-logic/models/lms/course.model";
import { LessonModel } from "@workspace/common-logic/models/lms/lesson.model";
import { IPaymentPlanHydratedDocument } from "@workspace/common-logic/models/payment/payment-plan.model";
import { ITagHydratedDocument } from "@workspace/common-logic/models/post/tag.model";
import { IThemeHydratedDocument } from "@workspace/common-logic/models/theme.model";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission, slugify } from "@workspace/utils";
import mongoose, { FilterQuery, RootFilterQuery } from "mongoose";
import { z } from "zod";
import {
  deleteAllLessons,
  getCourseOrThrow,
  syncCourseLessons
} from "./helpers";
import { CourseLevelEnum, CourseStatusEnum, ICourseChapter } from "@workspace/common-logic/models/lms/course.types";

// TODO: Add chapter reordering (like Frappe LMS update_chapter_index)
// TODO: Add SCORM package support (like Frappe LMS upsert_chapter with is_scorm_package)
// TODO: Add course deletion with cascade (like Frappe LMS delete_course)
// TODO: Add course progress distribution analytics (like Frappe LMS get_course_progress_distribution)

const addChapter = async ({
  course,
  data,
}: {
  course: ICourseHydratedDocument;
  data: {
    title: string;
    description?: string;
  },
}) => {
  if (course.chapters.some((ch) => ch.title === data.title)) {
    throw new ConflictException("Chapter with this title already exists");
  }
  const maxOrder = course.chapters.reduce((max, ch) => Math.max(max, ch.order), -1);
  course.chapters.push({
    _id: new mongoose.Types.ObjectId(),
    title: data.title,
    description: data.description,
    order: maxOrder + 1,
    lessonOrderIds: [],
  });
  await course.save();
  return course;
};

const removeChapter = async ({
  course,
  chapter,
  ctx,
}: {
  course: ICourseHydratedDocument;
  chapter: ICourseChapter;
  ctx: MainContextType;
}) => {
  if (chapter.lessonOrderIds && chapter.lessonOrderIds.length > 0) {
    throw new ConflictException("Cannot delete chapter with lessons");
  }

  course.chapters = course.chapters.filter((ch) => !ch._id.equals(chapter._id));
  await course.save();
  return course;
};

const updateCourseChapter = async ({
  chapter,
  course,
  data,
  ctx,
}: {
  chapter: ICourseChapter;
  course: ICourseHydratedDocument;
  data: {
    title?: string;
    description?: string;
    lessonOrderIds?: mongoose.Types.ObjectId[];
  };
  ctx: MainContextType;
}) => {
  const $set: any = {};
  if (data.title) {
    if (course.chapters?.some(((ch) => {
      return ch.title === data.title && !ch._id.equals(chapter._id)
    }))) {
      throw new ConflictException("Chapter with this title already exists");
    }

    $set["chapters.$.title"] = data.title;
  }

  if (data.description !== undefined) {
    $set["chapters.$.description"] = data.description;
  }

  if (data.lessonOrderIds) {
    $set["chapters.$.lessonOrderIds"] = Array.from(new Set(data.lessonOrderIds));
  }

  const updatedCourse = await CourseModel.findOneAndUpdate(
    {
      orgId: ctx.domainData.domainObj.orgId,
      _id: course._id,
      "chapters._id": chapter._id,
    },
    { $set },
    { new: true },
  );

  if (!updatedCourse) {
    throw new ConflictException("Chapter not found");
  }
  await syncCourseLessons({ course: updatedCourse, ctx });
  return updatedCourse;
};

export const courseRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([
        UIConstants.permissions.manageCourse,
        UIConstants.permissions.manageAnyCourse,
      ]),
    )
    .input(ListInputSchema.extend({
      filter: z.object({
        published: z.boolean().optional(),
        level: z.nativeEnum(CourseLevelEnum).optional(),
        status: z.nativeEnum(CourseStatusEnum).optional(),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const query: FilterQuery<ICourseHydratedDocument> = {
        orgId: ctx.domainData.domainObj.orgId
      };
      if (
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ])
      ) {
        query.ownerId = ctx.user._id;
      }
      if (input.filter?.published) query.published = input.filter.published;
      if (input.filter?.level) query.level = input.filter.level;
      if (input.filter?.status) query.status = input.filter.status;
      if (input.filter?.published) query.published = input.filter.published;
      if (input.search?.q) query.$text = { $search: input.search.q };
      const paginationMeta = paginate(input.pagination);
      const orderBy = input.orderBy || {
        field: "createdAt",
        direction: "desc",
      };
      const sortObject: Record<string, 1 | -1> = {
        [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
      };
      const [items, total] = await Promise.all([
        CourseModel.find(query)
          .populate<{
            owner: Pick<IUserHydratedDocument, "username" | "firstName" | "lastName" | "fullName" | "email">;
          }>("owner", "username firstName lastName fullName email")
          .populate<{
            tags: Pick<ITagHydratedDocument, "name">[];
          }>("tags", "name")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? CourseModel.countDocuments(query)
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
        withLessons: z.boolean().optional().default(false),
      }),
    )
    .query(async ({ ctx, input }) => {
      const course = await CourseModel.findOne({
        orgId: ctx.domainData.domainObj.orgId,
        _id: input.id,
      })
        .populate<{
          owner: Pick<IUserHydratedDocument, "username" | "firstName" | "lastName" | "fullName" | "email">;
        }>("owner", "username firstName lastName fullName email")
        .populate<{
          paymentPlans: Pick<IPaymentPlanHydratedDocument, "name" | "type" | "status">[];
        }>("paymentPlans", "name type status")
        .populate<{
          tags: Pick<ITagHydratedDocument, "name">[];
        }>("tags", "name")
        .populate<{
          theme: Pick<IThemeHydratedDocument, "name">;
        }>("theme", "name")
        .lean();

      if (!course) {
        throw new NotFoundException("Course", input.id);
      }
      return jsonify(course);
    }),

  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageCourse]))
    .input(
      getFormDataSchema({
        title: z.string().min(1).max(255),
        courseCode: z.string().min(1).max(50),
        level: z.nativeEnum(CourseLevelEnum).optional(),
        language: z.string().default("en"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const title = input.data.title;
      const course = await CourseModel.create({
        orgId: ctx.domainData.domainObj.orgId,
        title: title,
        courseCode: input.data.courseCode,
        level: input.data.level,
        language: input.data.language,
        slug: slugify(title.toLowerCase()),
        ownerId: ctx.user._id,
        durationInWeeks: 0,
        published: false,
        featured: false,
        upcoming: false,
        allowEnrollment: false,
        allowSelfEnrollment: false,
        paidCourse: false,
        status: CourseStatusEnum.IN_PROGRESS,
      });
      const updatedCourse = await addChapter({
        course,
        data: {
          title: "Section #1",
        },
      });
      return jsonify(updatedCourse.toObject());
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        title: z.string().min(1).max(255).optional(),
        slug: z.string().optional(),
        published: z.boolean().optional(),
        shortDescription: z.string().optional(),
        description: textEditorContentValidator().optional(),
        featuredImage: mediaWrappedFieldValidator().nullable().optional(),
        level: z.nativeEnum(CourseLevelEnum).optional(),
        status: z.nativeEnum(CourseStatusEnum).optional(),
        durationInWeeks: z.number().optional(),
        featured: z.boolean().optional(),
        upcoming: z.boolean().optional(),
        allowEnrollment: z.boolean().optional(),
        allowSelfEnrollment: z.boolean().optional(),
        paidCourse: z.boolean().optional(),
        themeId: documentIdValidator().nullish(),
      }, {
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const course = await getCourseOrThrow({ ctx, courseId: input.id });
      if (!course.ownerId.equals(ctx.user._id)) {
        throw new AuthorizationException();
      }
      const updatedCourse = await CourseModel.findOneAndUpdate(
        { _id: input.id, orgId: ctx.domainData.domainObj.orgId },
        { $set: input.data },
        { new: true },
      );
      if (!updatedCourse) {
        throw new NotFoundException("Course", input.id);
      }
      return jsonify(updatedCourse.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const course = await getCourseOrThrow({
        ctx,
        courseId: input.id,
      });
      await deleteAllLessons(course, ctx);
      if (course.featuredImage) {
        await deleteMedia(course.featuredImage);
      }
      await CourseModel.deleteOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });
      return {
        success: true,
      };
    }),




  addCourseChapter: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
      }, {
        courseId: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const course = await getCourseOrThrow({ ctx, courseId: input.courseId });
      const updatedCourse = await addChapter({
        course,
        data: {
          title: input.data.title,
          description: input.data.description,
        },
      });
      return jsonify(updatedCourse.toObject());
    }),

  updateCourseChapter: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        title: z.string().optional(),
        description: z.string().optional(),
        lessonOrderIds: z.array(documentIdValidator()).optional(),
      }, {
        courseId: documentIdValidator(),
        chapterId: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const course = await getCourseOrThrow({ ctx, courseId: input.courseId });
      const chapter = course.chapters.find((ch) => ch._id.equals(input.chapterId));
      if (!chapter) {
        throw new NotFoundException("Chapter", input.chapterId);
      }
      const updatedCourse = await updateCourseChapter({
        chapter,
        course,
        data: {
          title: input.data.title,
          description: input.data.description,
          lessonOrderIds: input.data.lessonOrderIds?.map(id => new mongoose.Types.ObjectId(id)),
        },
        ctx,
      });
      return jsonify(updatedCourse.toObject());
    }),

  removeCourseChapter: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        chapterId: documentIdValidator(),
        courseId: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const course = await getCourseOrThrow({ ctx, courseId: input.courseId });
      const chapter = course.chapters.find((ch) => ch._id.toString() === input.chapterId);
      if (!chapter) {
        throw new ConflictException("Chapter not found");
      }
      const updatedCourse = await removeChapter({
        course,
        chapter,
        ctx,
      });
      return jsonify(updatedCourse.toObject());
    }),

  publicList: publicProcedure
    .use(createDomainRequiredMiddleware())
    .input(ListInputSchema.extend({
      filter: z.object({
        level: z.nativeEnum(CourseLevelEnum).optional(),
        status: z.nativeEnum(CourseStatusEnum).optional(),
        language: z.string().optional(),
      }).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof CourseModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };
      if (input.filter?.level) query.level = input.filter.level;
      if (input.filter?.status) query.status = input.filter.status;
      if (input.filter?.language) query.language = input.filter.language;
      const paginationMeta = paginate(input.pagination);
      const orderBy = input.orderBy || {
        field: "createdAt",
        direction: "desc",
      };
      const sortObject: Record<string, 1 | -1> = {
        [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
      };
      const [items, total] = await Promise.all([
        CourseModel.find(query)
          .populate<{
            owner: Pick<IUserHydratedDocument, "username" | "firstName" | "lastName" | "fullName" | "email">;
          }>("owner", "username firstName lastName fullName email")
          .populate<{
            tags: Pick<ITagHydratedDocument, "name">[];
          }>("tags", "name")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? CourseModel.countDocuments(query)
          : Promise.resolve(null),
      ]);
      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  publicGetById: publicProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const course = await CourseModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
        published: true,
      })
        .populate<{
          owner: Pick<IUserHydratedDocument, "username" | "firstName" | "lastName" | "fullName" | "email">;
        }>("owner", "username firstName lastName fullName email")
        .populate<{
          paymentPlans: Pick<IPaymentPlanHydratedDocument, "name" | "type" | "status">[];
        }>("paymentPlans", "name type status")
        .populate<{
          tags: Pick<ITagHydratedDocument, "name">[];
        }>("tags", "name")
        .lean();

      if (!course) {
        throw new NotFoundException("Course", input.id);
      }

      return jsonify(course);
    }),

  publicGetByIdDetailed: publicProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const course = await CourseModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
        published: true,
      })
        .populate<{
          owner: Pick<IUserHydratedDocument, "username" | "firstName" | "lastName" | "fullName" | "email">;
        }>("owner", "username firstName lastName fullName email")
        .populate<{
          paymentPlans: Pick<IPaymentPlanHydratedDocument, "name" | "type" | "status">[];
        }>("paymentPlans", "name type status")
        .populate<{
          tags: Pick<ITagHydratedDocument, "name">[];
        }>("tags", "name")
        .lean();

      if (!course) {
        throw new NotFoundException("Course", input.id);
      }

      // Fetch all lessons for this course that are published
      const allLessons = await LessonModel.find({
        courseId: course._id,
        orgId: ctx.domainData.domainObj.orgId,
        published: true,
      })
        .select("_id title slug type requiresEnrollment media downloadable")
        .lean();

      // Create a map for quick lesson lookup
      const lessonMap = new Map(
        allLessons.map((lesson) => [lesson._id.toString(), lesson])
      );

      // Build the learning path structure: course > chapters > lessons
      const chaptersWithLessons = course.chapters
        .sort((a, b) => a.order - b.order)
        .map((chapter) => ({
          _id: chapter._id,
          title: chapter.title,
          description: chapter.description,
          order: chapter.order,
          lessons: chapter.lessonOrderIds
            .map((lessonId) => lessonMap.get(lessonId.toString()))
            .filter(Boolean), // Remove any lessons that don't exist or aren't published
        }));

      return jsonify({
        ...course,
        chapters: chaptersWithLessons,
      });
    }),
});