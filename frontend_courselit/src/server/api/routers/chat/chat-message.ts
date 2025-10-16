import { z } from "zod";
import { router } from "@/server/api/core/trpc";
import {
  createDomainRequiredMiddleware,
  protectedProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { NotFoundException, AuthorizationException } from "@/server/api/core/exceptions";
import {
  ChatMessageModel,
} from "@workspace/common-logic/models/chats/chat-message.model";
import { ChatRoomModel } from "@workspace/common-logic/models/chats/chat-room.model";
import { ChatParticipantModel } from "@workspace/common-logic/models/chats/chat-participant.model";
import { jsonify } from "@workspace/common-logic/lib/response";
import { RootFilterQuery } from "mongoose";
import { ChatMessageStatusEnum, ChatMessageTypeEnum } from "@workspace/common-logic/models/chats/chat-message.types";
import { ChatParticipantStatusEnum } from "@workspace/common-logic/models/chats/chat-participant.types";

const CreateMessageSchema = getFormDataSchema({
  roomId: documentIdValidator(),
  content: z.string().min(1).max(4000),
  type: z.nativeEnum(ChatMessageTypeEnum).default(ChatMessageTypeEnum.TEXT),
  replyToId: documentIdValidator().optional(),
  attachments: z
    .array(
      z.object({
        url: z.string(),
        mimeType: z.string(),
        size: z.number(),
        originalFileName: z.string().optional(),
      }),
    )
    .optional(),
});

const UpdateMessageSchema = getFormDataSchema(
  {
    content: z.string().min(1).max(4000).optional(),
    status: z.nativeEnum(ChatMessageStatusEnum).optional(),
  },
  {
    id: documentIdValidator(),
  },
);

export const chatMessageRouter = router({
  // List messages in a room
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      ListInputSchema.extend({
        roomId: documentIdValidator(),
        type: z.nativeEnum(ChatMessageTypeEnum).optional(),
        threadId: documentIdValidator().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if user is participant of the room
      const participant = await ChatParticipantModel.findOne({
        roomId: input.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!participant) {
        throw new AuthorizationException();
      }

      const query: RootFilterQuery<typeof ChatMessageModel> = {
        roomId: input.roomId,
        orgId: ctx.domainData.domainObj.orgId,
        status: { $ne: ChatMessageStatusEnum.DELETED },
      };

      // Filter by type
      if (input.type) {
        query.type = input.type;
      }

      // Filter by thread
      if (input.threadId) {
        query.threadId = input.threadId;
      }

      // Search functionality
      if (input.search?.q) {
        query.content = { $regex: input.search.q, $options: "i" };
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
        ChatMessageModel.find(query)
          .populate("sender", "firstName lastName email avatar")
          .populate("replyTo", "content senderId")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? ChatMessageModel.countDocuments(query)
          : Promise.resolve(null),
      ]);

      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  // Get a single message
  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const message = await ChatMessageModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate("sender", "firstName lastName email avatar")
        .populate("replyTo")
        .populate("readBy", "firstName lastName email avatar")
        .lean();

      if (!message) {
        throw new NotFoundException("Message", input.id);
      }

      // Check if user is participant of the room
      const participant = await ChatParticipantModel.findOne({
        roomId: message.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!participant) {
        throw new AuthorizationException();
      }

      return jsonify(message);
    }),

  // Send a message
  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(CreateMessageSchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user is participant and can send messages
      const participant = await ChatParticipantModel.findOne({
        roomId: input.data.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!participant) {
        throw new AuthorizationException();
      }

      if (
        participant.status !== ChatParticipantStatusEnum.ACTIVE ||
        !participant.canSendMessages
      ) {
        throw new AuthorizationException("You cannot send messages in this room");
      }

      // Check file upload permission
      if (
        input.data.type === ChatMessageTypeEnum.FILE &&
        !participant.canSendFiles
      ) {
        throw new AuthorizationException("You cannot upload files in this room");
      }

      // Create message
      const message = await ChatMessageModel.create({
        ...input.data,
        orgId: ctx.domainData.domainObj.orgId,
        senderId: ctx.user._id,
        status: ChatMessageStatusEnum.SENT,
      });

      // Update room's last message
      const room = await ChatRoomModel.findById(input.data.roomId);
      if (room) {
        room.lastMessageAt = new Date();
        room.lastMessageId = message._id;
        room.messageCount += 1;
        await room.save();
      }

      // Update participant's activity
      participant.lastMessageAt = new Date();
      participant.messageCount += 1;
      await participant.save();

      const populated = await ChatMessageModel.findById(message._id)
        .populate("sender", "firstName lastName email avatar")
        .populate("replyTo")
        .lean();

      return jsonify(populated);
    }),

  // Update/Edit a message
  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(UpdateMessageSchema)
    .mutation(async ({ ctx, input }) => {
      const message = await ChatMessageModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!message) {
        throw new NotFoundException("Message", input.id);
      }

      // Check if user is the sender or has delete permission
      const participant = await ChatParticipantModel.findOne({
        roomId: message.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      const canEdit =
        message.senderId.equals(ctx.user._id) ||
        (participant && participant.canDeleteMessages);

      if (!canEdit) {
        throw new AuthorizationException();
      }

      // Update message
      if (input.data.content) {
        message.content = input.data.content;
        message.editedAt = new Date();
        message.status = ChatMessageStatusEnum.EDITED;
      }

      if (input.data.status) {
        message.status = input.data.status;
      }

      const saved = await message.save();
      return jsonify(saved.toObject());
    }),

  // Delete a message
  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const message = await ChatMessageModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!message) {
        throw new NotFoundException("Message", input.id);
      }

      // Check if user is the sender or has delete permission
      const participant = await ChatParticipantModel.findOne({
        roomId: message.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      const canDelete =
        message.senderId.equals(ctx.user._id) ||
        (participant && participant.canDeleteMessages);

      if (!canDelete) {
        throw new AuthorizationException();
      }

      // Soft delete
      message.status = ChatMessageStatusEnum.DELETED;
      message.deletedAt = new Date();
      await message.save();

      // Update room message count
      const room = await ChatRoomModel.findById(message.roomId);
      if (room) {
        room.messageCount = Math.max(0, room.messageCount - 1);
        await room.save();
      }

      return { success: true };
    }),

  // Mark message as read
  markAsRead: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        messageId: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const message = await ChatMessageModel.findOne({
        _id: input.messageId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!message) {
        throw new NotFoundException("Message", input.messageId);
      }

      // Check if user is participant
      const participant = await ChatParticipantModel.findOne({
        roomId: message.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!participant) {
        throw new AuthorizationException();
      }

      // Add user to readBy list if not already there
      if (!message.readByUserIds.includes(ctx.user._id)) {
        message.readByUserIds.push(ctx.user._id);
        message.status = ChatMessageStatusEnum.READ;
        await message.save();
      }

      // Update participant's last seen
      participant.lastSeenAt = new Date();
      await participant.save();

      return { success: true };
    }),

  // Mark all messages in room as read
  markAllAsRead: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        roomId: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is participant
      const participant = await ChatParticipantModel.findOne({
        roomId: input.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!participant) {
        throw new AuthorizationException();
      }

      // Update all messages
      await ChatMessageModel.updateMany(
        {
          roomId: input.roomId,
          orgId: ctx.domainData.domainObj.orgId,
          senderId: { $ne: ctx.user._id },
          readByUserIds: { $ne: ctx.user._id },
        },
        {
          $addToSet: { readByUserIds: ctx.user._id },
          status: ChatMessageStatusEnum.READ,
        },
      );

      // Update participant's last seen
      participant.lastSeenAt = new Date();
      await participant.save();

      return { success: true };
    }),

  // Get unread count for a room
  getUnreadCount: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        roomId: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Check if user is participant
      const participant = await ChatParticipantModel.findOne({
        roomId: input.roomId,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!participant) {
        throw new AuthorizationException();
      }

      const count = await ChatMessageModel.countDocuments({
        roomId: input.roomId,
        orgId: ctx.domainData.domainObj.orgId,
        senderId: { $ne: ctx.user._id },
        readByUserIds: { $ne: ctx.user._id },
        status: { $ne: ChatMessageStatusEnum.DELETED },
      });

      return { count };
    }),
});

