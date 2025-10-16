import { AuthorizationException, ConflictException, NotFoundException } from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  protectedProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { jsonify } from "@workspace/common-logic/lib/response";
import {
  ChatParticipantModel,
} from "@workspace/common-logic/models/chats/chat-participant.model";
import { ChatParticipantRoleEnum, ChatParticipantStatusEnum } from "@workspace/common-logic/models/chats/chat-participant.types";
import { ChatRoomModel } from "@workspace/common-logic/models/chats/chat-room.model";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";

const AddParticipantSchema = getFormDataSchema({
  roomId: documentIdValidator(),
  userId: documentIdValidator(),
  role: z.nativeEnum(ChatParticipantRoleEnum).default(ChatParticipantRoleEnum.MEMBER),
});

const UpdateParticipantSchema = getFormDataSchema(
  {
    role: z.nativeEnum(ChatParticipantRoleEnum).optional(),
    status: z.nativeEnum(ChatParticipantStatusEnum).optional(),
    canSendMessages: z.boolean().optional(),
    canSendFiles: z.boolean().optional(),
    canInviteUsers: z.boolean().optional(),
    canDeleteMessages: z.boolean().optional(),
    notificationsEnabled: z.boolean().optional(),
  },
  {
    id: documentIdValidator(),
  },
);

export const chatParticipantRouter = router({
  // List participants in a room
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      ListInputSchema.extend({
        roomId: documentIdValidator(),
        role: z.nativeEnum(ChatParticipantRoleEnum).optional(),
        status: z.nativeEnum(ChatParticipantStatusEnum).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if user is participant of the room
      const userParticipant = await ChatParticipantModel.findOne({
        roomId: input.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!userParticipant) {
        throw new AuthorizationException();
      }

      const query: RootFilterQuery<typeof ChatParticipantModel> = {
        roomId: input.roomId,
        orgId: ctx.domainData.domainObj.orgId,
      };

      // Filter by role
      if (input.role) {
        query.role = input.role;
      }

      // Filter by status
      if (input.status) {
        query.status = input.status;
      } else {
        query.status = { $ne: ChatParticipantStatusEnum.LEFT };
      }

      // Search by user name/email
      if (input.search?.q) {
        // This requires populating first, so we'll handle it differently
      }

      const paginationMeta = paginate(input.pagination);
      const orderBy = input.orderBy || {
        field: "joinedAt",
        direction: "desc",
      };
      const sortObject: Record<string, 1 | -1> = {
        [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
      };

      const [items, total] = await Promise.all([
        ChatParticipantModel.find(query)
          .populate("user", "firstName lastName email avatar username")
          .populate("invitedBy", "firstName lastName email avatar")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? ChatParticipantModel.countDocuments(query)
          : Promise.resolve(null),
      ]);

      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  // Get participant details
  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const participant = await ChatParticipantModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate("user", "firstName lastName email avatar username")
        .populate("room")
        .populate("invitedBy", "firstName lastName email avatar")
        .lean();

      if (!participant) {
        throw new NotFoundException("Participant", input.id);
      }

      // Check if requesting user is in the same room
      const userParticipant = await ChatParticipantModel.findOne({
        roomId: participant.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!userParticipant) {
        throw new AuthorizationException();
      }

      return jsonify(participant);
    }),

  // Add a participant to a room
  add: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(AddParticipantSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if room exists
      const room = await ChatRoomModel.findOne({
        _id: input.data.roomId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!room) {
        throw new NotFoundException("Chat Room", input.data.roomId);
      }

      // Check if user can invite
      const inviterParticipant = await ChatParticipantModel.findOne({
        roomId: input.data.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (
        !inviterParticipant ||
        (!inviterParticipant.canInviteUsers &&
          !["admin", "moderator"].includes(inviterParticipant.role))
      ) {
        throw new AuthorizationException("You cannot invite users to this room");
      }

      // Check if already a participant
      const existing = await ChatParticipantModel.findOne({
        roomId: input.data.roomId,
        userId: input.data.userId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (existing && existing.status !== ChatParticipantStatusEnum.LEFT) {
        throw new ConflictException("User is already a participant");
      }

      // Check max participants
      if (room.maxParticipants) {
        const currentCount = await ChatParticipantModel.countDocuments({
          roomId: input.data.roomId,
          status: ChatParticipantStatusEnum.ACTIVE,
        });

        if (currentCount >= room.maxParticipants) {
          throw new ConflictException("Room has reached maximum participants");
        }
      }

      // If user previously left, reactivate
      if (existing) {
        existing.status = ChatParticipantStatusEnum.ACTIVE;
        existing.role = input.data.role;
        existing.joinedAt = new Date();
        existing.leftAt = undefined;
        existing.invitedById = ctx.user._id;
        await existing.save();

        // Update room participant count
        room.participantCount += 1;
        await room.save();

        return jsonify(existing.toObject());
      }

      // Create new participant
      const participant = await ChatParticipantModel.create({
        ...input.data,
        orgId: ctx.domainData.domainObj.orgId,
        status: ChatParticipantStatusEnum.ACTIVE,
        invitedById: ctx.user._id,
      });

      // Update room participant count
      room.participantCount += 1;
      await room.save();

      return jsonify(participant.toObject());
    }),

  // Update participant settings
  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(UpdateParticipantSchema)
    .mutation(async ({ ctx, input }) => {
      const participant = await ChatParticipantModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!participant) {
        throw new NotFoundException("Participant", input.id);
      }

      // Check permissions
      const userParticipant = await ChatParticipantModel.findOne({
        roomId: participant.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      // User can update their own settings (notificationsEnabled)
      const isSelf = participant.userId.equals(ctx.user._id);

      // Admin/Moderator can update others
      const canModerate =
        userParticipant &&
        ["admin", "moderator"].includes(userParticipant.role);

      if (!isSelf && !canModerate) {
        throw new AuthorizationException();
      }

      // If updating others, restrict certain fields
      if (!isSelf) {
        const allowedKeys = [
          "role",
          "status",
          "canSendMessages",
          "canSendFiles",
          "canInviteUsers",
          "canDeleteMessages",
        ];
        Object.keys(input.data).forEach((key) => {
          if (allowedKeys.includes(key)) {
            (participant as any)[key] = (input.data as any)[key];
          }
        });
      } else {
        // Self can only update notifications
        if (input.data.notificationsEnabled !== undefined) {
          participant.notificationsEnabled = input.data.notificationsEnabled;
        }
      }

      const saved = await participant.save();
      return jsonify(saved.toObject());
    }),

  // Remove participant from room (or leave room)
  remove: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const participant = await ChatParticipantModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!participant) {
        throw new NotFoundException("Participant", input.id);
      }

      const isSelf = participant.userId.equals(ctx.user._id);

      // Check if user can remove others
      if (!isSelf) {
        const userParticipant = await ChatParticipantModel.findOne({
          roomId: participant.roomId,
          userId: ctx.user._id,
          orgId: ctx.domainData.domainObj.orgId,
        });

        if (
          !userParticipant ||
          !["admin", "moderator"].includes(userParticipant.role)
        ) {
          throw new AuthorizationException();
        }
      }

      // Update status to LEFT
      participant.status = ChatParticipantStatusEnum.LEFT;
      participant.leftAt = new Date();
      await participant.save();

      // Update room participant count
      const room = await ChatRoomModel.findById(participant.roomId);
      if (room) {
        room.participantCount = Math.max(0, room.participantCount - 1);
        await room.save();
      }

      return { success: true };
    }),

  // Leave a room (convenience method)
  leave: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        roomId: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const participant = await ChatParticipantModel.findOne({
        roomId: input.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!participant) {
        throw new NotFoundException("Participant", "self");
      }

      // Cannot leave if you're the only admin
      if (participant.role === ChatParticipantRoleEnum.ADMIN) {
        const adminCount = await ChatParticipantModel.countDocuments({
          roomId: input.roomId,
          role: ChatParticipantRoleEnum.ADMIN,
          status: ChatParticipantStatusEnum.ACTIVE,
        });

        if (adminCount <= 1) {
          throw new ConflictException(
            "Cannot leave room as the only admin. Assign another admin first.",
          );
        }
      }

      participant.status = ChatParticipantStatusEnum.LEFT;
      participant.leftAt = new Date();
      await participant.save();

      // Update room participant count
      const room = await ChatRoomModel.findById(input.roomId);
      if (room) {
        room.participantCount = Math.max(0, room.participantCount - 1);
        await room.save();
      }

      return { success: true };
    }),

  // Update last seen timestamp
  updateLastSeen: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        roomId: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const participant = await ChatParticipantModel.findOneAndUpdate(
        {
          roomId: input.roomId,
          userId: ctx.user._id,
          orgId: ctx.domainData.domainObj.orgId,
        },
        {
          lastSeenAt: new Date(),
        },
        { new: true },
      );

      if (!participant) {
        throw new NotFoundException("Participant", "self");
      }

      return { success: true, lastSeenAt: participant.lastSeenAt };
    }),

  // Get online/active participants
  getOnlineParticipants: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        roomId: documentIdValidator(),
        minutesThreshold: z.number().default(5), // Consider online if seen in last 5 minutes
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if user is participant
      const userParticipant = await ChatParticipantModel.findOne({
        roomId: input.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!userParticipant) {
        throw new AuthorizationException();
      }

      const thresholdDate = new Date(
        Date.now() - input.minutesThreshold * 60 * 1000,
      );

      const participants = await ChatParticipantModel.find({
        roomId: input.roomId,
        orgId: ctx.domainData.domainObj.orgId,
        status: ChatParticipantStatusEnum.ACTIVE,
        lastSeenAt: { $gte: thresholdDate },
      })
        .populate("user", "firstName lastName email avatar username")
        .lean();

      return jsonify({
        count: participants.length,
        participants,
      });
    }),
});

