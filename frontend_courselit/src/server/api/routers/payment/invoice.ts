import {
  AuthorizationException,
  NotFoundException,
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  protectedProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { paginate } from "@/server/api/core/utils";
import { documentIdValidator } from "@/server/api/core/validators";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import {
  InvoiceModel,
} from "@workspace/common-logic/models/payment/invoice.model";
import { InvoiceStatusEnum } from "@workspace/common-logic/models/payment/invoice.types";
import { PaymentMethodEnum } from "@workspace/common-logic/models/payment/payment.types";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import mongoose, { RootFilterQuery } from "mongoose";
import { z } from "zod";

export const invoiceRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            userId: documentIdValidator().optional(),
            status: z.nativeEnum(InvoiceStatusEnum).optional(),
            paymentPlanId: documentIdValidator().optional(),
            paymentMethod: z.nativeEnum(PaymentMethodEnum).optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof InvoiceModel> = {
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

      if (input.filter?.paymentPlanId) {
        query["entity.entityId"] = new mongoose.Types.ObjectId(
          input.filter.paymentPlanId,
        );
      }

      if (input.filter?.paymentMethod) {
        query.paymentMethod = input.filter.paymentMethod;
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
        InvoiceModel.find(query)
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
          ? InvoiceModel.countDocuments(query)
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
      const invoice = await InvoiceModel.findOne({
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

      if (!invoice) {
        throw new NotFoundException("Invoice", input.id);
      }

      const canView =
        invoice.userId.equals(ctx.user._id) ||
        checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageSettings,
        ]);

      if (!canView) {
        throw new AuthorizationException();
      }

      return jsonify(invoice);
    }),

  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageSettings]))
    .input(
      getFormDataSchema({
        userId: documentIdValidator(),
        entityType: z.string(),
        entityId: documentIdValidator(),
        amount: z.number().min(0),
        currency: z.string().default("USD"),
        paymentMethod: z.nativeEnum(PaymentMethodEnum),
        description: z.string().optional(),
        dueDate: z.string().datetime().optional(),
        metadata: z.record(z.any()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await InvoiceModel.create({
        orgId: ctx.domainData.domainObj.orgId,
        userId: input.data.userId,
        entity: {
          entityType: input.data.entityType,
          entityId: new mongoose.Types.ObjectId(input.data.entityId),
          entityIdStr: input.data.entityId,
        },
        amount: input.data.amount,
        currency: input.data.currency,
        paymentMethod: input.data.paymentMethod,
        status: InvoiceStatusEnum.PENDING,
        description: input.data.description,
        dueDate: input.data.dueDate ? new Date(input.data.dueDate) : undefined,
        metadata: input.data.metadata,
      });

      return jsonify(invoice.toObject());
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageSettings]))
    .input(
      getFormDataSchema(
        {
          amount: z.number().min(0).optional(),
          status: z.nativeEnum(InvoiceStatusEnum).optional(),
          description: z.string().optional(),
          dueDate: z.string().datetime().optional(),
          paidAt: z.string().datetime().optional(),
          metadata: z.record(z.any()).optional(),
        },
        {
          id: documentIdValidator(),
        },
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await InvoiceModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!invoice) {
        throw new NotFoundException("Invoice", input.id);
      }

      Object.keys(input.data).forEach((key) => {
        if (key === "dueDate" || key === "paidAt") {
          (invoice as any)[key] = (input.data as any)[key]
            ? new Date((input.data as any)[key])
            : undefined;
        } else {
          (invoice as any)[key] = (input.data as any)[key];
        }
      });

      const saved = await invoice.save();
      return jsonify(saved.toObject());
    }),

  markPaid: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageSettings]))
    .input(
      z.object({
        id: documentIdValidator(),
        transactionId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await InvoiceModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!invoice) {
        throw new NotFoundException("Invoice", input.id);
      }

      invoice.status = InvoiceStatusEnum.PAID;
      invoice.paidAt = new Date();
      if (input.transactionId) {
        invoice.metadata = {
          ...invoice.metadata,
          transactionId: input.transactionId,
        };
      }

      const saved = await invoice.save();
      return jsonify(saved.toObject());
    }),

  markFailed: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(createPermissionMiddleware([UIConstants.permissions.manageSettings]))
    .input(
      z.object({
        id: documentIdValidator(),
        reason: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await InvoiceModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!invoice) {
        throw new NotFoundException("Invoice", input.id);
      }

      invoice.status = InvoiceStatusEnum.FAILED;
      if (input.reason) {
        invoice.metadata = {
          ...invoice.metadata,
          failureReason: input.reason,
        };
      }

      const saved = await invoice.save();
      return jsonify(saved.toObject());
    }),

  // TODO: Add generatePDF route for receipt generation
  // TODO: Add sendEmail route to email invoices to users
});

