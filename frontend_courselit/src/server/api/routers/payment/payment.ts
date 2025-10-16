import {
  AuthorizationException,
  NotFoundException,
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  protectedProcedure,
  publicProcedure
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { InvoiceModel } from "@workspace/common-logic/models/payment/invoice.model";
import { InvoiceStatusEnum } from "@workspace/common-logic/models/payment/invoice.types";
import {
  PaymentModel,
} from "@workspace/common-logic/models/payment/payment.model";
import { PaymentMethodEnum, PaymentStatusEnum } from "@workspace/common-logic/models/payment/payment.types";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import mongoose, { RootFilterQuery } from "mongoose";
import { z } from "zod";

export const paymentRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            userId: documentIdValidator().optional(),
            status: z.nativeEnum(PaymentStatusEnum).optional(),
            method: z.nativeEnum(PaymentMethodEnum).optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof PaymentModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageSettings,
        ])
      ) {
        query.userId = ctx.user._id;
      } else if (input.filter?.userId) {
        query.userId = input.filter.userId;
      }

      if (input.filter?.status) {
        query.status = input.filter.status;
      }

      if (input.filter?.method) {
        query.method = input.filter.method;
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
        PaymentModel.find(query)
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
          ? PaymentModel.countDocuments(query)
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
      const payment = await PaymentModel.findOne({
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

      if (!payment) {
        throw new NotFoundException("Payment", input.id);
      }

      const canView =
        payment.userId.equals(ctx.user._id) ||
        checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageSettings,
        ]);

      if (!canView) {
        throw new AuthorizationException();
      }

      return jsonify(payment);
    }),

  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        entityType: z.string(),
        entityId: documentIdValidator(),
        amount: z.number().min(0),
        currency: z.string().default("USD"),
        method: z.nativeEnum(PaymentMethodEnum),
        transactionId: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const payment = await PaymentModel.create({
        orgId: ctx.domainData.domainObj.orgId,
        userId: ctx.user._id,
        entity: {
          entityType: input.data.entityType,
          entityId: new mongoose.Types.ObjectId(input.data.entityId),
          entityIdStr: input.data.entityId,
        },
        amount: input.data.amount,
        currency: input.data.currency,
        method: input.data.method,
        status: PaymentStatusEnum.PENDING,
        transactionId: input.data.transactionId,
        metadata: input.data.metadata,
      });

      return jsonify(payment.toObject());
    }),

  verify: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      getFormDataSchema({
        transactionId: z.string(),
        provider: z.nativeEnum(PaymentMethodEnum),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const payment = await PaymentModel.findOne({
        transactionId: input.data.transactionId,
        method: input.data.provider,
        userId: ctx.user._id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!payment) {
        throw new NotFoundException("Payment", input.data.transactionId);
      }

      // TODO: Implement actual verification with payment provider APIs
      // For now, mark as completed
      payment.status = PaymentStatusEnum.COMPLETED;
      payment.processedAt = new Date();

      // Update associated invoice if exists
      const invoice = await InvoiceModel.findOne({
        "entity.entityId": payment.entity.entityId,
        userId: payment.userId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (invoice && invoice.status !== InvoiceStatusEnum.PAID) {
        invoice.status = InvoiceStatusEnum.PAID;
        invoice.paidAt = new Date();
        await invoice.save();
      }

      const saved = await payment.save();
      return jsonify(saved.toObject());
    }),

  cancel: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      z.object({
        id: documentIdValidator(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const payment = await PaymentModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!payment) {
        throw new NotFoundException("Payment", input.id);
      }

      const canCancel =
        payment.userId.equals(ctx.user._id) ||
        checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageSettings,
        ]);

      if (!canCancel) {
        throw new AuthorizationException();
      }

      payment.status = PaymentStatusEnum.CANCELLED;
      if (input.reason) {
        payment.metadata = {
          ...payment.metadata,
          cancellationReason: input.reason,
        };
      }

      const saved = await payment.save();
      return jsonify(saved.toObject());
    }),

  // Webhook handler for payment providers (Stripe, PayPal, etc.)
  handleWebhook: publicProcedure
    .input(
      z.object({
        provider: z.nativeEnum(PaymentMethodEnum),
        payload: z.record(z.any()),
        signature: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      // TODO: Implement webhook verification and processing
      // This requires provider-specific logic:
      // - Stripe: Verify signature using webhook secret
      // - PayPal: Verify IPN message
      // - etc.

      // Example structure:
      const { provider, payload } = input;

      switch (provider) {
        case PaymentMethodEnum.STRIPE:
          // TODO: Verify Stripe signature
          // TODO: Process Stripe event (payment_intent.succeeded, etc.)
          break;

        case PaymentMethodEnum.PAYPAL:
          // TODO: Verify PayPal IPN
          // TODO: Process PayPal event
          break;

        case PaymentMethodEnum.RAZORPAY:
          // TODO: Verify Razorpay signature
          // TODO: Process Razorpay event
          break;

        default:
          throw new Error(`Unsupported payment provider: ${provider}`);
      }

      return jsonify({
        success: true,
        message: "Webhook processed",
      });
    }),
});

