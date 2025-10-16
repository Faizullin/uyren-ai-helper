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
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import {
  ILiveClassHydratedDocument,
  LiveClassModel,
} from "@workspace/common-logic/models/lms/live-class.model";
import { LiveClassStatusEnum, LiveClassTypeEnum } from "@workspace/common-logic/models/lms/live-class.types";
import {
  LiveClassParticipantModel,
} from "@workspace/common-logic/models/lms/live-class-participant.model";
import { ParticipantStatusEnum } from "@workspace/common-logic/models/lms/live-class-participant.types";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import mongoose, { RootFilterQuery } from "mongoose";
import { z } from "zod";

const getLiveClassOrThrow = async (
  id: string,
  ctx: MainContextType,
): Promise<ILiveClassHydratedDocument> => {
  const liveClass = await LiveClassModel.findOne({
    _id: id,
    orgId: ctx.domainData.domainObj.orgId,
  });

  if (!liveClass) {
    throw new NotFoundException("Live Class", id);
  }

  const canAccess =
    liveClass.instructorId.equals(ctx.user._id) ||
    liveClass.createdById.equals(ctx.user._id) ||
    checkPermission(ctx.user.permissions, [
      UIConstants.permissions.manageAnyCourse,
    ]);

  if (!canAccess) {
    throw new AuthorizationException();
  }

  return liveClass;
};

export const liveClassRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            cohortId: documentIdValidator().optional(),
            instructorId: documentIdValidator().optional(),
            status: z.nativeEnum(LiveClassStatusEnum).optional(),
            type: z.nativeEnum(LiveClassTypeEnum).optional(),
            startDate: z.string().datetime().optional(),
            endDate: z.string().datetime().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof LiveClassModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (input.filter?.cohortId) {
        query.cohortId = input.filter.cohortId;
      }

      if (input.filter?.instructorId) {
        query.instructorId = input.filter.instructorId;
      }

      if (input.filter?.status) {
        query.status = input.filter.status;
      }

      if (input.filter?.type) {
        query.type = input.filter.type;
      }

      if (input.filter?.startDate) {
        query.scheduledStartTime = {
          $gte: new Date(input.filter.startDate),
        };
      }

      if (input.filter?.endDate) {
        query.scheduledEndTime = {
          $lte: new Date(input.filter.endDate),
        };
      }

      if (input.search?.q) {
        query.$text = { $search: input.search.q };
      }

      const paginationMeta = paginate(input.pagination);
      const orderBy = input.orderBy || {
        field: "scheduledStartTime",
        direction: "asc",
      };
      const sortObject: Record<string, 1 | -1> = {
        [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
      };

      const [items, total] = await Promise.all([
        LiveClassModel.find(query)
          .populate<{
            instructor: Pick<
              IUserHydratedDocument,
              "username" | "firstName" | "lastName" | "fullName" | "email"
            >;
          }>("instructor", "username firstName lastName fullName email")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? LiveClassModel.countDocuments(query)
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
      const liveClass = await LiveClassModel.findOne({
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
          createdBy: Pick<
            IUserHydratedDocument,
            "username" | "firstName" | "lastName" | "fullName"
          >;
        }>("createdBy", "username firstName lastName fullName")
        .lean();

      if (!liveClass) {
        throw new NotFoundException("Live Class", input.id);
      }

      return jsonify(liveClass);
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
        type: z.nativeEnum(LiveClassTypeEnum),
        entityType: z.string(),
        entityId: documentIdValidator(),
        instructorId: documentIdValidator(),
        cohortId: documentIdValidator().optional(),
        scheduledStartTime: z.string().datetime(),
        scheduledEndTime: z.string().datetime(),
        meetingUrl: z.string().url().optional(),
        meetingId: z.string().optional(),
        meetingPassword: z.string().optional(),
        maxParticipants: z.number().min(1).optional(),
        allowRecording: z.boolean().default(true),
        allowChat: z.boolean().default(true),
        allowScreenShare: z.boolean().default(true),
        allowParticipantVideo: z.boolean().default(true),
        locationName: z.string().optional(),
        locationOnline: z.boolean().default(true),
        locationRoom: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const liveClass = await LiveClassModel.create({
        orgId: ctx.domainData.domainObj.orgId,
        title: input.data.title,
        description: input.data.description,
        type: input.data.type,
        status: LiveClassStatusEnum.SCHEDULED,
        entity: {
          entityType: input.data.entityType,
          entityId: new mongoose.Types.ObjectId(input.data.entityId),
          entityIdStr: input.data.entityId,
        },
        instructorId: input.data.instructorId,
        cohortId: input.data.cohortId,
        scheduledStartTime: new Date(input.data.scheduledStartTime),
        scheduledEndTime: new Date(input.data.scheduledEndTime),
        meetingUrl: input.data.meetingUrl,
        meetingId: input.data.meetingId,
        meetingPassword: input.data.meetingPassword,
        maxParticipants: input.data.maxParticipants,
        allowRecording: input.data.allowRecording,
        allowChat: input.data.allowChat,
        allowScreenShare: input.data.allowScreenShare,
        allowParticipantVideo: input.data.allowParticipantVideo,
        location: input.data.locationName
          ? {
              name: input.data.locationName,
              online: input.data.locationOnline,
              room: input.data.locationRoom,
            }
          : undefined,
        createdById: ctx.user._id,
      });

      return jsonify(liveClass.toObject());
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
          type: z.nativeEnum(LiveClassTypeEnum).optional(),
          scheduledStartTime: z.string().datetime().optional(),
          scheduledEndTime: z.string().datetime().optional(),
          meetingUrl: z.string().url().optional(),
          meetingId: z.string().optional(),
          meetingPassword: z.string().optional(),
          maxParticipants: z.number().min(1).optional(),
          allowRecording: z.boolean().optional(),
          allowChat: z.boolean().optional(),
          allowScreenShare: z.boolean().optional(),
          allowParticipantVideo: z.boolean().optional(),
          locationName: z.string().optional(),
          locationOnline: z.boolean().optional(),
          locationRoom: z.string().optional(),
        },
        {
          id: documentIdValidator(),
        },
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const liveClass = await getLiveClassOrThrow(input.id, ctx);

      Object.keys(input.data).forEach((key) => {
        if (key === "scheduledStartTime" || key === "scheduledEndTime") {
          (liveClass as any)[key] = new Date((input.data as any)[key]);
        } else if (key.startsWith("location")) {
          if (!liveClass.location) {
            liveClass.location = { name: "", online: true };
          }
          if (key === "locationName")
            liveClass.location.name = input.data.locationName!;
          if (key === "locationOnline")
            liveClass.location.online = input.data.locationOnline!;
          if (key === "locationRoom")
            liveClass.location.room = input.data.locationRoom;
        } else {
          (liveClass as any)[key] = (input.data as any)[key];
        }
      });

      const saved = await liveClass.save();
      return jsonify(saved.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(z.object({ id: documentIdValidator() }))
    .mutation(async ({ ctx, input }) => {
      await getLiveClassOrThrow(input.id, ctx);

      await LiveClassModel.deleteOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      await LiveClassParticipantModel.deleteMany({
        liveClassId: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      return { success: true };
    }),

  start: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(z.object({ id: documentIdValidator() }))
    .mutation(async ({ ctx, input }) => {
      const liveClass = await getLiveClassOrThrow(input.id, ctx);

      if (
        !liveClass.instructorId.equals(ctx.user._id) &&
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ])
      ) {
        throw new AuthorizationException();
      }

      if (liveClass.status === LiveClassStatusEnum.LIVE) {
        throw new ConflictException("Live class is already started");
      }

      liveClass.status = LiveClassStatusEnum.LIVE;
      liveClass.actualStartTime = new Date();
      const saved = await liveClass.save();

      return jsonify(saved.toObject());
    }),

  end: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(z.object({ id: documentIdValidator() }))
    .mutation(async ({ ctx, input }) => {
      const liveClass = await getLiveClassOrThrow(input.id, ctx);

      if (
        !liveClass.instructorId.equals(ctx.user._id) &&
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ])
      ) {
        throw new AuthorizationException();
      }

      if (liveClass.status === LiveClassStatusEnum.ENDED) {
        throw new ConflictException("Live class is already ended");
      }

      liveClass.status = LiveClassStatusEnum.ENDED;
      liveClass.actualEndTime = new Date();
      const saved = await liveClass.save();

      return jsonify(saved.toObject());
    }),

  studentJoin: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(z.object({ id: documentIdValidator() }))
    .mutation(async ({ ctx, input }) => {
      const liveClass = await LiveClassModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!liveClass) {
        throw new NotFoundException("Live Class", input.id);
      }

      if (liveClass.status !== LiveClassStatusEnum.LIVE) {
        throw new ConflictException("Live class is not currently live");
      }

      const existingParticipant = await LiveClassParticipantModel.findOne({
        liveClassId: liveClass._id,
        userId: ctx.user._id,
      });

      const now = new Date();
      const lateThreshold = 15;
      const isLate =
        now >
        new Date(
          liveClass.scheduledStartTime.getTime() + lateThreshold * 60 * 1000,
        );
      const status = isLate
        ? ParticipantStatusEnum.LATE
        : ParticipantStatusEnum.PRESENT;

      if (existingParticipant) {
        existingParticipant.status = status;
        existingParticipant.joinedAt = now;
        const saved = await existingParticipant.save();
        return jsonify(saved.toObject());
      }

      const participant = await LiveClassParticipantModel.create({
        orgId: ctx.domainData.domainObj.orgId,
        liveClassId: liveClass._id,
        userId: ctx.user._id,
        status,
        joinedAt: now,
      });

      return jsonify(participant.toObject());
    }),

  studentLeave: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(z.object({ id: documentIdValidator() }))
    .mutation(async ({ ctx, input }) => {
      const liveClass = await LiveClassModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!liveClass) {
        throw new NotFoundException("Live Class", input.id);
      }

      const participant = await LiveClassParticipantModel.findOne({
        liveClassId: liveClass._id,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!participant) {
        throw new NotFoundException("Participant", ctx.user._id.toString());
      }

      if (participant.joinedAt) {
        participant.leftAt = new Date();
        participant.duration = Math.round(
          (participant.leftAt.getTime() - participant.joinedAt.getTime()) /
            (1000 * 60),
        );
        const saved = await participant.save();
        return jsonify(saved.toObject());
      }

      return jsonify(participant.toObject());
    }),

  listParticipants: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(z.object({ id: documentIdValidator() }))
    .query(async ({ ctx, input }) => {
      await getLiveClassOrThrow(input.id, ctx);

      const participants = await LiveClassParticipantModel.find({
        liveClassId: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          user: Pick<
            IUserHydratedDocument,
            "username" | "firstName" | "lastName" | "fullName" | "email"
          >;
        }>("user", "username firstName lastName fullName email")
        .populate<{
          markedBy: Pick<
            IUserHydratedDocument,
            "username" | "firstName" | "lastName" | "fullName"
          >;
        }>("markedBy", "username firstName lastName fullName")
        .sort({ createdAt: 1 })
        .lean();

      return jsonify(participants);
    }),

  markAttendance: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      getFormDataSchema(
        {
          userId: documentIdValidator(),
          status: z.nativeEnum(ParticipantStatusEnum),
          notes: z.string().optional(),
        },
        {
          id: documentIdValidator(),
        },
      ),
    )
    .mutation(async ({ ctx, input }) => {
      await getLiveClassOrThrow(input.id, ctx);

      const existingParticipant = await LiveClassParticipantModel.findOne({
        liveClassId: input.id,
        userId: input.data.userId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (existingParticipant) {
        existingParticipant.status = input.data.status;
        existingParticipant.notes = input.data.notes;
        existingParticipant.markedById = ctx.user._id;
        if (
          input.data.status === ParticipantStatusEnum.PRESENT ||
          input.data.status === ParticipantStatusEnum.LATE
        ) {
          existingParticipant.joinedAt = new Date();
        }
        const saved = await existingParticipant.save();
        return jsonify(saved.toObject());
      }

      const participant = await LiveClassParticipantModel.create({
        orgId: ctx.domainData.domainObj.orgId,
        liveClassId: input.id,
        userId: input.data.userId,
        status: input.data.status,
        joinedAt:
          input.data.status === ParticipantStatusEnum.PRESENT ||
          input.data.status === ParticipantStatusEnum.LATE
            ? new Date()
            : undefined,
        notes: input.data.notes,
        markedById: ctx.user._id,
      });

      return jsonify(participant.toObject());
    }),

  getStats: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(z.object({ id: documentIdValidator() }))
    .query(async ({ ctx, input }) => {
      await getLiveClassOrThrow(input.id, ctx);

      const participants = await LiveClassParticipantModel.find({
        liveClassId: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      const stats = {
        total: participants.length,
        present: participants.filter(
          (p) => p.status === ParticipantStatusEnum.PRESENT,
        ).length,
        late: participants.filter((p) => p.status === ParticipantStatusEnum.LATE)
          .length,
        absent: participants.filter(
          (p) => p.status === ParticipantStatusEnum.ABSENT,
        ).length,
        excused: participants.filter(
          (p) => p.status === ParticipantStatusEnum.EXCUSED,
        ).length,
      };

      stats.present += stats.late;

      return jsonify(stats);
    }),

  studentListMyAttendance: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        cohortId: documentIdValidator().optional(),
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof LiveClassParticipantModel> = {
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (input.cohortId) {
        const liveClasses = await LiveClassModel.find({
          cohortId: input.cohortId,
          orgId: ctx.domainData.domainObj.orgId,
        }).select("_id");

        query.liveClassId = {
          $in: liveClasses.map((lc) => lc._id),
        };
      }

      if (input.startDate) {
        query.createdAt = { $gte: new Date(input.startDate) };
      }

      if (input.endDate) {
        query.createdAt = {
          ...((query.createdAt as any) || {}),
          $lte: new Date(input.endDate),
        };
      }

      const attendance = await LiveClassParticipantModel.find(query)
        .populate("liveClass", "title scheduledStartTime type")
        .sort({ createdAt: -1 })
        .lean();

      return jsonify(attendance);
    }),
});
