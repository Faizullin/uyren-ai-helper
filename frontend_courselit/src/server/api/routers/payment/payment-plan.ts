import {
  AuthorizationException,
  ConflictException,
  NotFoundException,
  ValidationException,
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
import { PaymentPlanModel } from "@workspace/common-logic/models/payment/payment-plan.model";
import {
  PaymentPlanStatusEnum,
  PaymentPlanTypeEnum,
} from "@workspace/common-logic/models/payment/payment-plan.types";
import { IUserHydratedDocument } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import { RootFilterQuery } from "mongoose";
import { z } from "zod";

const getPaymentPlanOrThrow = async (id: string, ctx: MainContextType) => {
  const paymentPlan = await PaymentPlanModel.findOne({
    _id: id,
    orgId: ctx.domainData.domainObj.orgId,
  });

  if (!paymentPlan) {
    throw new NotFoundException("PaymentPlan", id);
  }

  if (
    !checkPermission(ctx.user.permissions, [
      UIConstants.permissions.manageAnyCourse,
    ])
  ) {
    if (!paymentPlan.ownerId.equals(ctx.user._id)) {
      throw new AuthorizationException();
    }
  }

  return paymentPlan;
};

const validatePaymentPlanAmounts = (
  type: PaymentPlanTypeEnum,
  data: {
    oneTimeAmount?: number;
    emiAmount?: number;
    emiTotalInstallments?: number;
    subscriptionMonthlyAmount?: number;
    subscriptionYearlyAmount?: number;
  },
) => {
  if (type === PaymentPlanTypeEnum.ONE_TIME && !data.oneTimeAmount) {
    throw new ValidationException(
      "One-time amount is required for one-time payment plan",
    );
  }

  if (
    type === PaymentPlanTypeEnum.EMI &&
    (!data.emiAmount || !data.emiTotalInstallments)
  ) {
    throw new ValidationException(
      "EMI amount and total installments are required for EMI payment plan",
    );
  }

  if (type === PaymentPlanTypeEnum.SUBSCRIPTION) {
    const hasMonthly = !!data.subscriptionMonthlyAmount;
    const hasYearly = !!data.subscriptionYearlyAmount;

    if (!hasMonthly && !hasYearly) {
      throw new ValidationException(
        "Either monthly or yearly amount is required for subscription payment plan",
      );
    }
  }

  if (type === PaymentPlanTypeEnum.FREE) {
    if (
      data.oneTimeAmount ||
      data.emiAmount ||
      data.subscriptionMonthlyAmount ||
      data.subscriptionYearlyAmount
    ) {
      throw new ValidationException(
        "Free payment plans cannot have any amounts",
      );
    }
  }
};

export const paymentPlanRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            type: z.nativeEnum(PaymentPlanTypeEnum).optional(),
            status: z.nativeEnum(PaymentPlanStatusEnum).optional(),
            entityType: z.string().optional(),
            entityId: documentIdValidator().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const query: RootFilterQuery<typeof PaymentPlanModel> = {
        orgId: ctx.domainData.domainObj.orgId,
      };

      if (
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ])
      ) {
        query.ownerId = ctx.user._id;
      }

      if (input.filter?.type) {
        query.type = input.filter.type;
      }

      if (input.filter?.status) {
        query.status = input.filter.status;
      }

      if (input.filter?.entityType) {
        query["entity.entityType"] = input.filter.entityType;
      }

      if (input.filter?.entityId) {
        query["entity.entityId"] = input.filter.entityId;
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
        PaymentPlanModel.find(query)
          .populate<{
            owner: Pick<
              IUserHydratedDocument,
              "username" | "firstName" | "lastName" | "fullName" | "email"
            >;
          }>("owner", "username firstName lastName fullName email")
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .sort(sortObject)
          .lean(),
        paginationMeta.includePaginationCount
          ? PaymentPlanModel.countDocuments(query)
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
      const paymentPlan = await PaymentPlanModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      })
        .populate<{
          owner: Pick<
            IUserHydratedDocument,
            "username" | "firstName" | "lastName" | "fullName" | "email"
          >;
        }>("owner", "username firstName lastName fullName email")
        .lean();

      if (!paymentPlan) {
        throw new NotFoundException("PaymentPlan", input.id);
      }

      if (
        !checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageAnyCourse,
        ])
      ) {
        if (!paymentPlan.ownerId.equals(ctx.user._id)) {
          throw new AuthorizationException();
        }
      }

      return jsonify(paymentPlan);
    }),

  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      getFormDataSchema({
        name: z.string().min(2).max(255),
        type: z.nativeEnum(PaymentPlanTypeEnum),
        status: z
          .nativeEnum(PaymentPlanStatusEnum)
          .default(PaymentPlanStatusEnum.ACTIVE),
        oneTimeAmount: z.number().min(0).optional(),
        emiAmount: z.number().min(0).optional(),
        emiTotalInstallments: z.number().min(1).max(24).optional(),
        subscriptionMonthlyAmount: z.number().min(0).optional(),
        subscriptionYearlyAmount: z.number().min(0).optional(),
        currency: z.string().length(3).default("USD"),
        entityType: z.string().optional(),
        entityIdStr: z.string().optional(),
        isDefault: z.boolean().default(false),
        isInternal: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      validatePaymentPlanAmounts(input.data.type, input.data);

      const entity =
        input.data.entityType && input.data.entityIdStr
          ? {
            entityType: input.data.entityType,
            entityIdStr: input.data.entityIdStr,
          }
          : undefined;

      const { entityType, entityIdStr, ...paymentPlanData } = input.data;

      const paymentPlan = await PaymentPlanModel.create({
        ...paymentPlanData,
        entity,
        orgId: ctx.domainData.domainObj.orgId,
        ownerId: ctx.user._id,
      });

      return jsonify(paymentPlan.toObject());
    }),

  update: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      getFormDataSchema(
        {
          name: z.string().min(2).max(255).optional(),
          status: z.nativeEnum(PaymentPlanStatusEnum).optional(),
          oneTimeAmount: z.number().min(0).optional(),
          emiAmount: z.number().min(0).optional(),
          emiTotalInstallments: z.number().min(1).max(24).optional(),
          subscriptionMonthlyAmount: z.number().min(0).optional(),
          subscriptionYearlyAmount: z.number().min(0).optional(),
          currency: z.string().length(3).optional(),
          isDefault: z.boolean().optional(),
          isInternal: z.boolean().optional(),
        },
        {
          id: documentIdValidator(),
        },
      ),
    )
    .mutation(async ({ ctx, input }) => {
      const paymentPlan = await getPaymentPlanOrThrow(input.id, ctx);

      if (input.data.oneTimeAmount !== undefined || input.data.emiAmount !== undefined || input.data.subscriptionMonthlyAmount !== undefined || input.data.subscriptionYearlyAmount !== undefined) {
        validatePaymentPlanAmounts(paymentPlan.type, {
          oneTimeAmount: input.data.oneTimeAmount ?? paymentPlan.oneTimeAmount,
          emiAmount: input.data.emiAmount ?? paymentPlan.emiAmount,
          emiTotalInstallments: input.data.emiTotalInstallments ?? paymentPlan.emiTotalInstallments,
          subscriptionMonthlyAmount: input.data.subscriptionMonthlyAmount ?? paymentPlan.subscriptionMonthlyAmount,
          subscriptionYearlyAmount: input.data.subscriptionYearlyAmount ?? paymentPlan.subscriptionYearlyAmount,
        });
      }

      Object.keys(input.data).forEach((key) => {
        (paymentPlan as any)[key] = (input.data as any)[key];
      });

      const saved = await paymentPlan.save();
      return jsonify(saved.toObject());
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const paymentPlan = await getPaymentPlanOrThrow(input.id, ctx);

      if (paymentPlan.isDefault) {
        throw new ConflictException(
          "Cannot delete default payment plan. Please set another plan as default first.",
        );
      }

      await PaymentPlanModel.deleteOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      return { success: true };
    }),

  archive: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const paymentPlan = await getPaymentPlanOrThrow(input.id, ctx);

      if (paymentPlan.isDefault) {
        throw new ConflictException(
          "Cannot archive default payment plan. Please set another plan as default first.",
        );
      }

      paymentPlan.status = PaymentPlanStatusEnum.ARCHIVED;
      const saved = await paymentPlan.save();

      return jsonify(saved.toObject());
    }),

  setDefault: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageAnyCourse]),
    )
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const paymentPlan = await getPaymentPlanOrThrow(input.id, ctx);

      if (paymentPlan.status === PaymentPlanStatusEnum.ARCHIVED) {
        throw new ConflictException(
          "Cannot set archived payment plan as default",
        );
      }

      if (!paymentPlan.entity?.entityType || !paymentPlan.entity?.entityIdStr) {
        throw new ValidationException(
          "Payment plan must be associated with an entity to be set as default",
        );
      }

      await PaymentPlanModel.updateMany(
        {
          orgId: ctx.domainData.domainObj.orgId,
          "entity.entityType": paymentPlan.entity.entityType,
          "entity.entityIdStr": paymentPlan.entity.entityIdStr,
          _id: { $ne: input.id },
        },
        {
          $set: { isDefault: false },
        },
      );

      paymentPlan.isDefault = true;
      const saved = await paymentPlan.save();

      return jsonify(saved.toObject());
    }),
});
