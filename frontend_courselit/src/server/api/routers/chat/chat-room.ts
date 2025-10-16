import { AuthorizationException, NotFoundException } from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  protectedProcedure
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { ChatParticipantModel } from "@workspace/common-logic/models/chats/chat-participant.model";
import {
  ChatRoomModel,
} from "@workspace/common-logic/models/chats/chat-room.model";
import { ChatRoomStatusEnum, ChatRoomTypeEnum } from "@workspace/common-logic/models/chats/chat-room.types";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";

const CreateChatRoomSchema = getFormDataSchema({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: z.nativeEnum(ChatRoomTypeEnum),
  isPrivate: z.boolean().default(false),
  allowInvites: z.boolean().default(true),
  allowFileUploads: z.boolean().default(true),
  allowReactions: z.boolean().default(true),
  maxParticipants: z.number().min(2).max(1000).optional(),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

const UpdateChatRoomSchema = getFormDataSchema(
  {
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
    status: z.nativeEnum(ChatRoomStatusEnum).optional(),
    allowInvites: z.boolean().optional(),
    allowFileUploads: z.boolean().optional(),
    allowReactions: z.boolean().optional(),
    maxParticipants: z.number().min(2).max(1000).optional(),
  },
  {
    id: documentIdValidator(),
  },
);

export const chatRoomRouter = router({
  // List chat rooms for the current user
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      ListInputSchema.extend({
        type: z.nativeEnum(ChatRoomTypeEnum).optional(),
        status: z.nativeEnum(ChatRoomStatusEnum).optional(),
        entityType: z.string().optional(),
        entityId: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof ChatRoomModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      // Filter by type
      if (input.type) {
        query.type = input.type;
      }

      // Filter by status
      if (input.status) {
        query.status = input.status;
      } else {
        query.status = ChatRoomStatusEnum.ACTIVE;
      }

      // Filter by entity
      if (input.entityType && input.entityId) {
        query["entity.entityType"] = input.entityType;
        query["entity.entityId"] = input.entityId;
      }

      // Search functionality
      if (input.search?.q) {
        query.$or = [
          { name: { $regex: input.search.q, $options: "i" } },
          { description: { $regex: input.search.q, $options: "i" } },
        ];
      }

      const paginationMeta = paginate(input.pagination);
      const orderBy = input.orderBy || {
        field: "lastMessageAt",
        direction: "desc",
      };
      const sortObject: Record<string, 1 | -1> = {
        [orderBy.field]: orderBy.direction === "asc" ? 1 : -1,
      };

      // Find rooms where user is a participant
      const participations = await ChatParticipantModel.find({
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      const roomIds = participations.map((p) => p.roomId);
      query._id = { $in: roomIds };

      const [items, total] = await Promise.all([
        ChatRoomModel.find(query)
          .populate("createdBy", "firstName lastName email avatar")
          .populate("lastMessage")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? ChatRoomModel.countDocuments(query)
          : Promise.resolve(null),
      ]);

      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  // Get a single chat room by ID
  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const room = await ChatRoomModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate("createdBy", "firstName lastName email avatar")
        .populate("moderators", "firstName lastName email avatar")
        .populate("lastMessage")
        .lean();

      if (!room) {
        throw new NotFoundException("Chat Room", input.id);
      }

      // Check if user is a participant
      const participant = await ChatParticipantModel.findOne({
        roomId: room._id,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!participant) {
        throw new AuthorizationException();
      }

      return jsonify(room);
    }),

  // Create a new chat room
  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(CreateChatRoomSchema)
    .mutation(async ({ ctx, input }) => {
      const roomData: any = {
        ...input.data,
        orgId: ctx.domainData.domainObj.orgId,
        createdById: ctx.user._id,
      };

      // Add entity if provided
      if (input.data.entityType && input.data.entityId) {
        roomData.entity = {
          entityType: input.data.entityType,
          entityId: input.data.entityId,
        };
      }

      const room = await ChatRoomModel.create(roomData);

      // Automatically add creator as participant (admin)
      await ChatParticipantModel.create({
        orgId: ctx.domainData.domainObj.orgId,
        roomId: room._id,
        userId: ctx.user._id,
        role: "admin",
        status: "active",
        canSendMessages: true,
        canSendFiles: true,
        canInviteUsers: true,
        canDeleteMessages: true,
      });

      // Update participant count
      room.participantCount = 1;
      await room.save();

      return jsonify(room.toObject());
    }),

  // Update chat room
  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(UpdateChatRoomSchema)
    .mutation(async ({ ctx, input }) => {
      const room = await ChatRoomModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!room) {
        throw new NotFoundException("Chat Room", input.id);
      }

      // Check if user is admin/moderator of the room
      const participant = await ChatParticipantModel.findOne({
        roomId: room._id,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!participant || !["admin", "moderator"].includes(participant.role)) {
        throw new AuthorizationException();
      }

      Object.keys(input.data).forEach((key) => {
        (room as any)[key] = (input.data as any)[key];
      });

      const saved = await room.save();
      return jsonify(saved.toObject());
    }),

  // Delete/Archive chat room
  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const room = await ChatRoomModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!room) {
        throw new NotFoundException("Chat Room", input.id);
      }

      // Check if user is admin of the room or has manage permission
      const participant = await ChatParticipantModel.findOne({
        roomId: room._id,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      const hasPermission =
        participant?.role === "admin" ||
        ctx.user.permissions?.includes(UIConstants.permissions.manageSettings);

      if (!hasPermission) {
        throw new AuthorizationException();
      }

      // Archive instead of delete
      room.status = ChatRoomStatusEnum.ARCHIVED;
      await room.save();

      return { success: true };
    }),

  // Add moderator to room
  addModerator: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        roomId: documentIdValidator(),
        userId: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const room = await ChatRoomModel.findOne({
        _id: input.roomId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!room) {
        throw new NotFoundException("Chat Room", input.roomId);
      }

      // Check if user is admin
      const participant = await ChatParticipantModel.findOne({
        roomId: room._id,
        userId: ctx.user._id,
        role: "admin",
      });

      if (!participant) {
        throw new AuthorizationException();
      }

      // Update target user's role
      const targetParticipant = await ChatParticipantModel.findOneAndUpdate(
        {
          roomId: input.roomId,
          userId: input.userId,
          orgId: ctx.domainData.domainObj.orgId,
        },
        {
          role: "moderator",
          canDeleteMessages: true,
          canInviteUsers: true,
        },
        { new: true },
      );

      if (!targetParticipant) {
        throw new NotFoundException("Participant", input.userId);
      }

      // Add to moderator list
      if (!room.moderatorIds.includes(input.userId as any)) {
        room.moderatorIds.push(input.userId as any);
        await room.save();
      }

      return jsonify(targetParticipant.toObject());
    }),

  // Mute user in room
  muteUser: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        roomId: documentIdValidator(),
        userId: documentIdValidator(),
        muteUntil: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const room = await ChatRoomModel.findOne({
        _id: input.roomId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!room) {
        throw new NotFoundException("Chat Room", input.roomId);
      }

      // Check if user is moderator or admin
      const participant = await ChatParticipantModel.findOne({
        roomId: room._id,
        userId: ctx.user._id,
        role: { $in: ["admin", "moderator"] },
      });

      if (!participant) {
        throw new AuthorizationException();
      }

      // Mute the target user
      const targetParticipant = await ChatParticipantModel.findOneAndUpdate(
        {
          roomId: input.roomId,
          userId: input.userId,
          orgId: ctx.domainData.domainObj.orgId,
        },
        {
          status: "muted",
          canSendMessages: false,
          muteUntil: input.muteUntil,
        },
        { new: true },
      );

      if (!targetParticipant) {
        throw new NotFoundException("Participant", input.userId);
      }

      // Add to muted list
      if (!room.mutedUserIds.includes(input.userId as any)) {
        room.mutedUserIds.push(input.userId as any);
        await room.save();
      }

      return jsonify(targetParticipant.toObject());
    }),
});

