import {
  AuthorizationException,
  ConflictException,
  NotFoundException,
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import {
  EnrollmentModel,  
} from "@workspace/common-logic/models/lms/enrollment.model";
import { CourseEnrollmentMemberTypeEnum, CourseEnrollmentRoleEnum, EnrollmentStatusEnum } from "@workspace/common-logic/models/lms/enrollment.types";
import { CourseModel } from "@workspace/common-logic/models/lms/course.model";
import { UserProgressModel } from "@workspace/common-logic/models/lms/user-progress.model";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import mongoose, { RootFilterQuery } from "mongoose";
import { z } from "zod";

export const enrollmentRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            courseId: documentIdValidator().optional(),
            userId: documentIdValidator().optional(),
            status: z.nativeEnum(EnrollmentStatusEnum).optional(),
            role: z.nativeEnum(CourseEnrollmentRoleEnum).optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof EnrollmentModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ])
      ) {
        query.userId = ctx.user._id;
      }

      if (input.filter?.courseId) {
        query.courseId = input.filter.courseId;
      }

      if (input.filter?.userId) {
        query.userId = input.filter.userId;
      }

      if (input.filter?.status) {
        query.status = input.filter.status;
      }

      if (input.filter?.role) {
        query.role = input.filter.role;
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
        EnrollmentModel.find(query)
          .populate<{
            user: Pick<
              IUserHydratedDocument,
              "username" | "firstName" | "lastName" | "fullName" | "email"
            >;
          }>("user", "username firstName lastName fullName email")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? EnrollmentModel.countDocuments(query)
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
      const enrollment = await EnrollmentModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          user: Pick<
            IUserHydratedDocument,
            "username" | "firstName" | "lastName" | "fullName" | "email"
          >;
        }>("user", "username firstName lastName fullName email")
        .lean();

      if (!enrollment) {
        throw new NotFoundException("Enrollment", input.id);
      }

      const canView =
        enrollment.userId.equals(ctx.user._id) ||
        checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ]);

      if (!canView) {
        throw new AuthorizationException();
      }

      return jsonify(enrollment);
    }),

  // TODO: Implement Frappe-like cohort join request flow
  enroll: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        courseId: documentIdValidator(),
        role: z
          .nativeEnum(CourseEnrollmentRoleEnum)
          .default(CourseEnrollmentRoleEnum.MEMBER),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const course = await CourseModel.findOne({
        _id: input.data.courseId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!course) {
        throw new NotFoundException("Course", input.data.courseId);
      }

      const existingEnrollment = await EnrollmentModel.findOne({
        courseId: input.data.courseId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (existingEnrollment) {
        throw new ConflictException("You are already enrolled in this course");
      }

      const enrollment = await EnrollmentModel.create({
        courseId: input.data.courseId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
        memberType: input.data.role === CourseEnrollmentRoleEnum.ADMIN 
          ? CourseEnrollmentMemberTypeEnum.STAFF 
          : CourseEnrollmentMemberTypeEnum.STUDENT,
        role: input.data.role,
        status: EnrollmentStatusEnum.ACTIVE,
      });

      return jsonify(enrollment.toObject());
    }),

  // TODO: Add progress tracking like Frappe LMS (save_current_lesson)
  updateProgress: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        enrollmentId: documentIdValidator(),
        lessonId: documentIdValidator(),
        status: z.enum(["completed", "in_progress", "not_started"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const enrollment = await EnrollmentModel.findOne({
        _id: input.data.enrollmentId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!enrollment) {
        throw new NotFoundException("Enrollment", input.data.enrollmentId);
      }

      let progress = await UserProgressModel.findOne({
        userId: ctx.user._id,
        courseId: enrollment.courseId,
        enrollmentId: enrollment._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!progress) {
        progress = await UserProgressModel.create({
          userId: ctx.user._id,
          courseId: enrollment.courseId,
          enrollmentId: enrollment._id,
          orgId: ctx.domainData.domainObj.orgId,
          lessons: [
            {
              lessonId: input.data.lessonId,
              status: input.data.status as any,
              completedAt: input.data.status === "completed" ? new Date() : undefined,
            },
          ],
        });
      } else {
        const lessonIndex = progress.lessons.findIndex((l: any) =>
          l.lessonId.equals(input.data.lessonId),
        );

        if (lessonIndex >= 0) {
          (progress.lessons[lessonIndex] as any).status = input.data.status;
          (progress.lessons[lessonIndex] as any).completedAt =
            input.data.status === "completed" ? new Date() : undefined;
        } else {
          progress.lessons.push({
            lessonId: input.data.lessonId,
            status: input.data.status as any,
            completedAt: input.data.status === "completed" ? new Date() : undefined,
          } as any);
        }

        await progress.save();
      }

      return jsonify(progress.toObject());
    }),

  // Get enrollment progress summary
  getProgress: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        enrollmentId: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const enrollment = await EnrollmentModel.findOne({
        _id: input.enrollmentId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!enrollment) {
        throw new NotFoundException("Enrollment", input.enrollmentId);
      }

      const canView =
        enrollment.userId.equals(ctx.user._id) ||
        checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ]);

      if (!canView) {
        throw new AuthorizationException();
      }

      const progress = await UserProgressModel.findOne({
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        enrollmentId: enrollment._id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!progress) {
        return jsonify({
          enrollmentId: input.enrollmentId,
          totalLessons: 0,
          totalCompleted: 0,
          percentComplete: 0,
          lessons: [],
        });
      }

      const totalLessons = progress.lessons.length;
      const totalCompleted = progress.lessons.filter(
        (l) => l.status === "completed",
      ).length;
      const percentComplete =
        totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

      return jsonify({
        enrollmentId: input.enrollmentId,
        totalLessons,
        totalCompleted,
        percentComplete,
        lessons: progress.lessons,
      });
    }),

  unenroll: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const enrollment = await EnrollmentModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!enrollment) {
        throw new NotFoundException("Enrollment", input.id);
      }

      const canUnenroll =
        enrollment.userId.equals(ctx.user._id) ||
        checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ]);

      if (!canUnenroll) {
        throw new AuthorizationException();
      }

      await EnrollmentModel.deleteOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      return { success: true };
    }),

  // Get course progress for a specific student
  getCourseProgress: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        courseId: documentIdValidator(),
        userId: documentIdValidator().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const userId = input.userId || ctx.user._id;

      if (
        input.userId &&
        input.userId !== ctx.user._id.toString() &&
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ])
      ) {
        throw new AuthorizationException();
      }

      const progress = await UserProgressModel.findOne({
        userId: new mongoose.Types.ObjectId(userId.toString()),
        courseId: input.courseId,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!progress) {
        return jsonify({
          courseId: input.courseId,
          userId,
          percentComplete: 0,
          totalLessons: 0,
          completedLessons: 0,
          lessons: [],
        });
      }

      const totalLessons = progress.lessons.length;
      const completedLessons = progress.lessons.filter(
        (l) => l.status === "completed",
      ).length;
      const percentComplete =
        totalLessons > 0
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0;

      return jsonify({
        courseId: input.courseId,
        userId,
        percentComplete,
        totalLessons,
        completedLessons,
        lessons: progress.lessons,
        lastActivity: (progress as any).updatedAt,
      });
    }),

  // Get progress for all students in a course (instructor view)
  getBulkProgress: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      z.object({
        courseId: documentIdValidator(),
        cohortId: documentIdValidator().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const enrollmentQuery: RootFilterQuery<typeof EnrollmentModel> = {
        courseId: input.courseId,
        memberType: CourseEnrollmentMemberTypeEnum.STUDENT,
        status: EnrollmentStatusEnum.ACTIVE,
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (input.cohortId) {
        enrollmentQuery.cohortId = input.cohortId;
      }

      const enrollments = await EnrollmentModel.find(enrollmentQuery)
        .populate<{
          user: Pick<
            IUserHydratedDocument,
            "username" | "firstName" | "lastName" | "fullName" | "email"
          >;
        }>("user", "username firstName lastName fullName email")
        .lean();

      const progressDocs = await UserProgressModel.find({
        courseId: input.courseId,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      const progressMap = new Map(
        progressDocs.map((p) => [p.userId.toString(), p]),
      );

      const studentsProgress = enrollments.map((enrollment) => {
        const progress = progressMap.get(enrollment.userId.toString());
        const totalLessons = progress?.lessons.length || 0;
        const completedLessons =
          progress?.lessons.filter((l) => l.status === "completed").length || 0;
        const percentComplete =
          totalLessons > 0
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0;

        return {
          user: enrollment.user,
          enrollmentId: enrollment._id,
          percentComplete,
          totalLessons,
          completedLessons,
          lastActivity: (progress as any)?.updatedAt,
        };
      });

      return jsonify(studentsProgress);
    }),
});

