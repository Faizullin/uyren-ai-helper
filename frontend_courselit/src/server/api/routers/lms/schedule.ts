import {
  AuthorizationException,
  NotFoundException,
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  MainContextType,
  protectedProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { ICohortHydratedDocument } from "@workspace/common-logic/models/lms/cohort.model";
import {
  EnrollmentModel,
} from "@workspace/common-logic/models/lms/enrollment.model";
import { EnrollmentStatusEnum } from "@workspace/common-logic/models/lms/enrollment.types";
import {
  IScheduleEventHydratedDocument,
  ScheduleEventModel,
} from "@workspace/common-logic/models/lms/schedule.model";
import { RecurrenceTypeEnum, ScheduleStatusEnum, ScheduleTypeEnum } from "@workspace/common-logic/models/lms/schedule.types";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import mongoose, { RootFilterQuery } from "mongoose";
import { z } from "zod";

const getScheduleOrThrow = async (
  id: string,
  ctx: MainContextType,
): Promise<IScheduleEventHydratedDocument> => {
  const schedule = await ScheduleEventModel.findOne({
    _id: id,
    orgId: ctx.domainData.domainObj.orgId,
  });

  if (!schedule) {
    throw new NotFoundException("Schedule Event", id);
  }

  const canAccess =
    schedule.instructorId?.equals(ctx.user._id) ||
    checkPermission(ctx.user.permissions, [
      UIConstants.permissions.manageAnyCourse,
    ]);

  if (!canAccess) {
    throw new AuthorizationException();
  }

  return schedule;
};

export const scheduleRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            cohortId: documentIdValidator().optional(),
            instructorId: documentIdValidator().optional(),
            type: z.nativeEnum(ScheduleTypeEnum).optional(),
            status: z.nativeEnum(ScheduleStatusEnum).optional(),
            startDate: z.string().datetime().optional(),
            endDate: z.string().datetime().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof ScheduleEventModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (input.filter?.cohortId) {
        query.cohortId = input.filter.cohortId;
      }

      if (input.filter?.instructorId) {
        query.instructorId = input.filter.instructorId;
      }

      if (input.filter?.type) {
        query.type = input.filter.type;
      }

      if (input.filter?.status) {
        query.status = input.filter.status;
      }

      if (input.filter?.startDate && input.filter?.endDate) {
        query.$or = [
          {
            startDate: {
              $gte: new Date(input.filter.startDate),
              $lte: new Date(input.filter.endDate),
            },
          },
          {
            endDate: {
              $gte: new Date(input.filter.startDate),
              $lte: new Date(input.filter.endDate),
            },
          },
        ];
      } else if (input.filter?.startDate) {
        query.startDate = { $gte: new Date(input.filter.startDate) };
      } else if (input.filter?.endDate) {
        query.endDate = { $lte: new Date(input.filter.endDate) };
      }

      if (input.search?.q) {
        query.$text = { $search: input.search.q };
      }

      const paginationMeta = paginate(input.pagination);
      const orderBy = input.orderBy || {
        field: "startDate",
        direction: "asc",
      };
      const sortObject: Record<string, 1 | -1> = {
        [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
      };

      const [items, total] = await Promise.all([
        ScheduleEventModel.find(query)
          .populate<{
            instructor: Pick<
              IUserHydratedDocument,
              "username" | "firstName" | "lastName" | "fullName" | "email"
            >;
          }>("instructor", "username firstName lastName fullName email")
          .populate<{
            cohort: Pick<ICohortHydratedDocument, "title" | "slug">;
          }>("cohort", "title slug")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? ScheduleEventModel.countDocuments(query)
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
      const schedule = await ScheduleEventModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          instructor: Pick<
            IUserHydratedDocument,
            "username" | "firstName" | "lastName" | "fullName" | "email"
          >;
        }>("instructor", "username firstName lastName fullName email")
        .populate<{
          cohort: Pick<ICohortHydratedDocument, "title" | "slug">;
        }>("cohort", "title slug")
        .lean();

      if (!schedule) {
        throw new NotFoundException("Schedule Event", input.id);
      }

      return jsonify(schedule);
    }),

  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      getFormDataSchema({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        type: z.nativeEnum(ScheduleTypeEnum),
        entityType: z.string(),
        entityId: documentIdValidator(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
        allDay: z.boolean().default(false),
        recurrenceType: z
          .nativeEnum(RecurrenceTypeEnum)
          .default(RecurrenceTypeEnum.NONE),
        recurrenceInterval: z.number().min(1).default(1),
        recurrenceDaysOfWeek: z.array(z.number().min(0).max(6)).optional(),
        recurrenceEndDate: z.string().datetime().optional(),
        locationName: z.string().optional(),
        locationOnline: z.boolean().default(false),
        locationMeetingUrl: z.string().url().optional(),
        instructorId: documentIdValidator().optional(),
        cohortId: documentIdValidator().optional(),
        remindersEnabled: z.boolean().default(true),
        remindersMinutesBefore: z.array(z.number()).default([15, 60]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const schedule = await ScheduleEventModel.create({
        orgId: ctx.domainData.domainObj.orgId,
        title: input.data.title,
        description: input.data.description,
        type: input.data.type,
        status: ScheduleStatusEnum.ACTIVE,
        entity: {
          entityType: input.data.entityType,
          entityId: new mongoose.Types.ObjectId(input.data.entityId),
          entityIdStr: input.data.entityId,
        },
        startDate: new Date(input.data.startDate),
        endDate: new Date(input.data.endDate),
        allDay: input.data.allDay,
        recurrence: {
          type: input.data.recurrenceType,
          interval: input.data.recurrenceInterval,
          daysOfWeek: input.data.recurrenceDaysOfWeek,
          endDate: input.data.recurrenceEndDate
            ? new Date(input.data.recurrenceEndDate)
            : undefined,
        },
        location: input.data.locationName
          ? {
            name: input.data.locationName,
            online: input.data.locationOnline,
            meetingUrl: input.data.locationMeetingUrl,
          }
          : undefined,
        instructorId: input.data.instructorId,
        cohortId: input.data.cohortId,
        reminders: {
          enabled: input.data.remindersEnabled,
          minutesBefore: input.data.remindersMinutesBefore,
        },
      });

      return jsonify(schedule.toObject());
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
          description: z.string().optional(),
          type: z.nativeEnum(ScheduleTypeEnum).optional(),
          startDate: z.string().datetime().optional(),
          endDate: z.string().datetime().optional(),
          allDay: z.boolean().optional(),
          status: z.nativeEnum(ScheduleStatusEnum).optional(),
          recurrenceType: z.nativeEnum(RecurrenceTypeEnum).optional(),
          recurrenceInterval: z.number().min(1).optional(),
          recurrenceDaysOfWeek: z.array(z.number().min(0).max(6)).optional(),
          recurrenceEndDate: z.string().datetime().optional(),
          locationName: z.string().optional(),
          locationOnline: z.boolean().optional(),
          locationMeetingUrl: z.string().url().optional(),
          instructorId: documentIdValidator().optional(),
          cohortId: documentIdValidator().optional(),
          remindersEnabled: z.boolean().optional(),
          remindersMinutesBefore: z.array(z.number()).optional(),
        },
        {
          id: documentIdValidator(),
        },
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const schedule = await getScheduleOrThrow(input.id, ctx);

      Object.keys(input.data).forEach((key) => {
        if (key === "startDate" || key === "endDate") {
          (schedule as any)[key] = new Date((input.data as any)[key]);
        } else if (key.startsWith("recurrence")) {
          if (!schedule.recurrence) {
            schedule.recurrence = {
              type: RecurrenceTypeEnum.NONE,
              interval: 1,
            };
          }
          if (key === "recurrenceType")
            schedule.recurrence.type = input.data.recurrenceType!;
          if (key === "recurrenceInterval")
            schedule.recurrence.interval = input.data.recurrenceInterval!;
          if (key === "recurrenceDaysOfWeek")
            schedule.recurrence.daysOfWeek = input.data.recurrenceDaysOfWeek;
          if (key === "recurrenceEndDate")
            schedule.recurrence.endDate = input.data.recurrenceEndDate
              ? new Date(input.data.recurrenceEndDate)
              : undefined;
        } else if (key.startsWith("location")) {
          if (!schedule.location) {
            schedule.location = { name: "", online: false };
          }
          if (key === "locationName")
            schedule.location.name = input.data.locationName!;
          if (key === "locationOnline")
            schedule.location.online = input.data.locationOnline!;
          if (key === "locationMeetingUrl")
            schedule.location.meetingUrl = input.data.locationMeetingUrl;
        } else if (key.startsWith("reminders")) {
          if (!schedule.reminders) {
            schedule.reminders = { enabled: true, minutesBefore: [15, 60] };
          }
          if (key === "remindersEnabled")
            schedule.reminders.enabled = input.data.remindersEnabled!;
          if (key === "remindersMinutesBefore")
            schedule.reminders.minutesBefore =
              input.data.remindersMinutesBefore!;
        } else {
          (schedule as any)[key] = (input.data as any)[key];
        }
      });

      const saved = await schedule.save();
      return jsonify(saved.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(z.object({ id: documentIdValidator() }))
    .mutation(async ({ ctx, input }) => {
      await getScheduleOrThrow(input.id, ctx);

      await ScheduleEventModel.deleteOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      return { success: true };
    }),

  studentGetMyTimetable: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const enrollments = await EnrollmentModel.find({
        userId: ctx.user._id,
        status: EnrollmentStatusEnum.ACTIVE,
        orgId: ctx.domainData.domainObj.orgId,
      });

      const cohortIds = enrollments
        .filter((e) => e.cohortId)
        .map((e) => e.cohortId);

      if (cohortIds.length === 0) {
        return jsonify([]);
      }

      const events = await ScheduleEventModel.find({
        cohortId: { $in: cohortIds },
        $or: [
          {
            startDate: {
              $gte: new Date(input.startDate),
              $lte: new Date(input.endDate),
            },
          },
          {
            endDate: {
              $gte: new Date(input.startDate),
              $lte: new Date(input.endDate),
            },
          },
        ],
        status: ScheduleStatusEnum.ACTIVE,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          instructor: Pick<
            IUserHydratedDocument,
            "username" | "firstName" | "lastName" | "fullName"
          >;
        }>("instructor", "username firstName lastName fullName")
        .populate<{
          cohort: Pick<ICohortHydratedDocument, "title">;
        }>("cohort", "title")
        .sort({ startDate: 1 })
        .lean();

      return jsonify(events);
    }),

  publicGetCohortSchedule: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        cohortId: documentIdValidator(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const events = await ScheduleEventModel.find({
        cohortId: input.cohortId,
        $or: [
          {
            startDate: {
              $gte: new Date(input.startDate),
              $lte: new Date(input.endDate),
            },
          },
          {
            endDate: {
              $gte: new Date(input.startDate),
              $lte: new Date(input.endDate),
            },
          },
        ],
        status: ScheduleStatusEnum.ACTIVE,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          instructor: Pick<
            IUserHydratedDocument,
            "username" | "firstName" | "lastName" | "fullName"
          >;
        }>("instructor", "username firstName lastName fullName")
        .sort({ startDate: 1 })
        .lean();

      return jsonify(events);
    }),

  instructorGetMySchedule: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const events = await ScheduleEventModel.find({
        instructorId: ctx.user._id,
        $or: [
          {
            startDate: {
              $gte: new Date(input.startDate),
              $lte: new Date(input.endDate),
            },
          },
          {
            endDate: {
              $gte: new Date(input.startDate),
              $lte: new Date(input.endDate),
            },
          },
        ],
        status: ScheduleStatusEnum.ACTIVE,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          cohort: Pick<ICohortHydratedDocument, "title">;
        }>("cohort", "title")
        .sort({ startDate: 1 })
        .lean();

      return jsonify(events);
    }),

  adminGetInstructorSchedule: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      z.object({
        instructorId: documentIdValidator(),
        startDate: z.string().datetime(),
        endDate: z.string().datetime(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const events = await ScheduleEventModel.find({
        instructorId: input.instructorId,
        $or: [
          {
            startDate: {
              $gte: new Date(input.startDate),
              $lte: new Date(input.endDate),
            },
          },
          {
            endDate: {
              $gte: new Date(input.startDate),
              $lte: new Date(input.endDate),
            },
          },
        ],
        status: ScheduleStatusEnum.ACTIVE,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          cohort: Pick<ICohortHydratedDocument, "title">;
        }>("cohort", "title")
        .sort({ startDate: 1 })
        .lean();

      return jsonify(events);
    }),
});
