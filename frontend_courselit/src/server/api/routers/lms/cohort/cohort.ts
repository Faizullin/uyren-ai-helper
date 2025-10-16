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
    CohortModel,
} from "@workspace/common-logic/models/lms/cohort.model";
import { CohortStatusEnum } from "@workspace/common-logic/models/lms/cohort.types";
import { CourseModel, ICourseHydratedDocument } from "@workspace/common-logic/models/lms/course.model";
import { EnrollmentModel } from "@workspace/common-logic/models/lms/enrollment.model";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";

export const cohortRouter = router({
    list: protectedProcedure
        .use(createDomainRequiredMiddleware())
        .use(
            createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
        )
        .input(
            ListInputSchema.extend({
                filter: z
                    .object({
                        courseId: documentIdValidator().optional(),
                        instructorId: documentIdValidator().optional(),
                        status: z.nativeEnum(CohortStatusEnum).optional(),
                    })
                    .optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const query: RootFilterQuery<typeof CohortModel> = {
                orgId: ctx.domainData.domainObj.orgId,
            };

            if (input.filter?.courseId) {
                query.courseId = input.filter.courseId;
            }

            if (input.filter?.instructorId) {
                query.instructorId = input.filter.instructorId;
            }

            if (input.filter?.status) {
                query.status = input.filter.status;
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
                CohortModel.find(query)
                    .populate<{
                        course: Pick<ICourseHydratedDocument, "title">;
                    }>("course", "title")
                    .populate<{
                        instructor: Pick<
                            IUserHydratedDocument,
                            "username" | "firstName" | "lastName" | "fullName"
                        >;
                    }>("instructor", "username firstName lastName fullName")
                    .populate<{
                        owner: Pick<
                            IUserHydratedDocument,
                            "username" | "firstName" | "lastName" | "fullName"
                        >;
                    }>("owner", "username firstName lastName fullName")
                    .skip(paginationMeta.skip)
                    .limit(paginationMeta.take)
                    .sort(sortObject)
                    .lean(),
                paginationMeta.includePaginationCount
                    ? CohortModel.countDocuments(query)
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
        .input(z.object({ id: documentIdValidator() }))
        .query(async ({ ctx, input }) => {
            const cohort = await CohortModel.findOne({
                _id: input.id,
                orgId: ctx.domainData.domainObj.orgId,
            })
                .populate<{
                    course: Pick<ICourseHydratedDocument, "title">;
                }>("course", "title")
                .populate<{
                    instructor: Pick<
                        IUserHydratedDocument,
                        "username" | "firstName" | "lastName" | "fullName" | "email"
                    >;
                }>("instructor", "username firstName lastName fullName email")
                .populate<{
                    owner: Pick<
                        IUserHydratedDocument,
                        "username" | "firstName" | "lastName" | "fullName" | "email"
                    >;
                }>("owner", "username firstName lastName fullName email")
                .lean();

            if (!cohort) {
                throw new NotFoundException("Cohort", input.id);
            }

            const hasAdminAccess = checkPermission(ctx.user.permissions, [
                UIConstants.permissions.manageAnyCourse,
            ]);

            if (!hasAdminAccess) {
                const enrollment = await EnrollmentModel.findOne({
                    userId: ctx.user._id,
                    cohortId: input.id,
                    orgId: ctx.domainData.domainObj.orgId,
                });

                if (
                    !enrollment &&
                    !cohort.instructorId.equals(ctx.user._id) &&
                    !cohort.ownerId.equals(ctx.user._id)
                ) {
                    throw new AuthorizationException();
                }
            }

            return jsonify(cohort);
        }),

    create: protectedProcedure
        .use(createDomainRequiredMiddleware())
        .use(
            createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
        )
        .input(
            getFormDataSchema({
                title: z.string().min(1).max(255),
                slug: z.string().min(1).max(255),
                description: z.string().optional(),
                courseId: documentIdValidator(),
                instructorId: documentIdValidator().optional(),
                status: z
                    .nativeEnum(CohortStatusEnum)
                    .default(CohortStatusEnum.UPCOMING),
                beginDate: z.string().datetime().optional(),
                endDate: z.string().datetime().optional(),
                duration_in_weeks: z.number().min(1).optional(),
                inviteCode: z.string().min(6).max(50),
                maxCapacity: z.number().min(1).optional(),
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

            const existingCohort = await CohortModel.findOne({
                slug: input.data.slug,
                orgId: ctx.domainData.domainObj.orgId,
            });

            if (existingCohort) {
                throw new ConflictException("Cohort with this slug already exists");
            }

            const cohort = await CohortModel.create({
                title: input.data.title,
                slug: input.data.slug,
                description: input.data.description,
                courseId: input.data.courseId,
                instructorId: input.data.instructorId || ctx.user._id,
                status: input.data.status,
                beginDate: input.data.beginDate
                    ? new Date(input.data.beginDate)
                    : undefined,
                endDate: input.data.endDate ? new Date(input.data.endDate) : undefined,
                duration_in_weeks: input.data.duration_in_weeks,
                inviteCode: input.data.inviteCode,
                maxCapacity: input.data.maxCapacity,
                orgId: ctx.domainData.domainObj.orgId,
                ownerId: ctx.user._id,
            });

            return jsonify(cohort.toObject());
        }),

    update: protectedProcedure
        .use(createDomainRequiredMiddleware())
        .use(
            createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
        )
        .input(
            getFormDataSchema(
                {
                    title: z.string().min(1).max(255).optional(),
                    slug: z.string().min(1).max(255).optional(),
                    description: z.string().optional(),
                    instructorId: documentIdValidator().optional(),
                    status: z.nativeEnum(CohortStatusEnum).optional(),
                    beginDate: z.string().datetime().optional(),
                    endDate: z.string().datetime().optional(),
                    duration_in_weeks: z.number().min(1).optional(),
                    inviteCode: z.string().min(6).max(50).optional(),
                    maxCapacity: z.number().min(1).optional(),
                },
                {
                    id: documentIdValidator(),
                },
            ),
        )
        .mutation(async ({ ctx, input }) => {
            const cohort = await CohortModel.findOne({
                _id: input.id,
                orgId: ctx.domainData.domainObj.orgId,
            });

            if (!cohort) {
                throw new NotFoundException("Cohort", input.id);
            }

            if (input.data.slug && input.data.slug !== cohort.slug) {
                const existingCohort = await CohortModel.findOne({
                    slug: input.data.slug,
                    orgId: ctx.domainData.domainObj.orgId,
                    _id: { $ne: input.id },
                });

                if (existingCohort) {
                    throw new ConflictException("Cohort with this slug already exists");
                }
            }

            Object.keys(input.data).forEach((key) => {
                if (["beginDate", "endDate"].includes(key)) {
                    (cohort as any)[key] = (input.data as any)[key]
                        ? new Date((input.data as any)[key])
                        : undefined;
                } else {
                    (cohort as any)[key] = (input.data as any)[key];
                }
            });

            const saved = await cohort.save();
            return jsonify(saved.toObject());
        }),

    delete: protectedProcedure
        .use(createDomainRequiredMiddleware())
        .use(
            createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
        )
        .input(z.object({ id: documentIdValidator() }))
        .mutation(async ({ ctx, input }) => {
            const cohort = await CohortModel.findOne({
                _id: input.id,
                orgId: ctx.domainData.domainObj.orgId,
            });

            if (!cohort) {
                throw new NotFoundException("Cohort", input.id);
            }

            const enrollmentCount = await EnrollmentModel.countDocuments({
                cohortId: input.id,
                orgId: ctx.domainData.domainObj.orgId,
            });

            if (enrollmentCount > 0) {
                throw new ConflictException(
                    "Cannot delete cohort with existing enrollments",
                );
            }

            await CohortModel.deleteOne({
                _id: input.id,
                orgId: ctx.domainData.domainObj.orgId,
            });

            return { success: true };
        }),

    studentListMyCohorts: protectedProcedure
        .use(createDomainRequiredMiddleware())
        .input(ListInputSchema)
        .query(async ({ ctx, input }) => {
            const enrollments = await EnrollmentModel.find({
                userId: ctx.user._id,
                orgId: ctx.domainData.domainObj.orgId,
            }).select("cohortId");

            const cohortIds = enrollments
                .filter((e) => e.cohortId)
                .map((e) => e.cohortId);

            if (cohortIds.length === 0) {
                return jsonify({
                    items: [],
                    total: 0,
                    meta: paginate(input.pagination),
                });
            }

            const query: RootFilterQuery<typeof CohortModel> = {
                _id: { $in: cohortIds },
                orgId: ctx.domainData.domainObj.orgId,
            };

            if (input.search?.q) {
                query.$text = { $search: input.search.q };
            }

            const paginationMeta = paginate(input.pagination);
            const orderBy = input.orderBy || {
                field: "beginDate",
                direction: "desc",
            };
            const sortObject: Record<string, 1 | -1> = {
                [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
            };

            const [items, total] = await Promise.all([
                CohortModel.find(query)
                    .populate<{
                        course: Pick<ICourseHydratedDocument, "title">;
                    }>("course", "title")
                    .populate<{
                        instructor: Pick<
                            IUserHydratedDocument,
                            "username" | "firstName" | "lastName" | "fullName"
                        >;
                    }>("instructor", "username firstName lastName fullName")
                    .skip(paginationMeta.skip)
                    .limit(paginationMeta.take)
                    .sort(sortObject)
                    .lean(),
                paginationMeta.includePaginationCount
                    ? CohortModel.countDocuments(query)
                    : Promise.resolve(null),
            ]);

            return jsonify({
                items,
                total,
                meta: paginationMeta,
            });
        }),

    publicListActive: publicProcedure
        .use(createDomainRequiredMiddleware())
        .input(
            ListInputSchema.extend({
                filter: z
                    .object({
                        courseId: documentIdValidator().optional(),
                    })
                    .optional(),
            }),
        )
        .query(async ({ ctx, input }) => {
            const query: RootFilterQuery<typeof CohortModel> = {
                orgId: ctx.domainData.domainObj.orgId,
                status: { $in: [CohortStatusEnum.UPCOMING, CohortStatusEnum.LIVE] },
            };

            if (input.filter?.courseId) {
                query.courseId = input.filter.courseId;
            }

            if (input.search?.q) {
                query.$text = { $search: input.search.q };
            }

            const paginationMeta = paginate(input.pagination);
            const orderBy = input.orderBy || {
                field: "beginDate",
                direction: "asc",
            };
            const sortObject: Record<string, 1 | -1> = {
                [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
            };

            const [items, total] = await Promise.all([
                CohortModel.find(query)
                    .populate<{
                        course: Pick<ICourseHydratedDocument, "title">;
                    }>("course", "title")
                    .populate<{
                        instructor: Pick<
                            IUserHydratedDocument,
                            "username" | "firstName" | "lastName" | "fullName"
                        >;
                    }>("instructor", "username firstName lastName fullName")
                    .select("-inviteCode")
                    .skip(paginationMeta.skip)
                    .limit(paginationMeta.take)
                    .sort(sortObject)
                    .lean(),
                paginationMeta.includePaginationCount
                    ? CohortModel.countDocuments(query)
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
        .input(z.object({ id: documentIdValidator() }))
        .query(async ({ ctx, input }) => {
            const cohort = await CohortModel.findOne({
                _id: input.id,
                orgId: ctx.domainData.domainObj.orgId,
                status: { $in: [CohortStatusEnum.UPCOMING, CohortStatusEnum.LIVE] },
            })
                .populate<{
                    course: Pick<ICourseHydratedDocument, "title" | "description">;
                }>("course", "title description")
                .populate<{
                    instructor: Pick<
                        IUserHydratedDocument,
                        "username" | "firstName" | "lastName" | "fullName"
                    >;
                }>("instructor", "username firstName lastName fullName")
                .select("-inviteCode")
                .lean();

            if (!cohort) {
                throw new NotFoundException("Cohort", input.id);
            }

            return jsonify(cohort);
        }),
});

