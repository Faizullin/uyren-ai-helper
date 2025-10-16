import {
  NotFoundException,
  ValidationException
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { mediaWrappedFieldValidator } from "@/server/api/core/validators";
import DomainManager from "@/server/lib/domain";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import {
  DomainModel,
  ISiteInfo,
} from "@workspace/common-logic/models/organization.model";
import { checkPermission } from "@workspace/utils";
import { z } from "zod";

import currencies from "@/data/currencies.json";

const currencyISOCodes = currencies.map((currency) =>
  currency.isoCode?.toLowerCase(),
);

function validatePaymentSettings(siteInfo: ISiteInfo) {
  if (siteInfo.currencyISOCode) {
    if (!currencyISOCodes.includes(siteInfo.currencyISOCode.toLowerCase())) {
      throw new ValidationException("Unrecognised currency code");
    }
  }

  if (siteInfo.paymentMethods?.stripe) {
    if (!siteInfo.currencyISOCode) {
      throw new ValidationException("Currency ISO code is required");
    }

    if (
      siteInfo.paymentMethods.stripe.type === "stripe" &&
      (!siteInfo.paymentMethods.stripe.stripeKey ||
        !siteInfo.paymentMethods.stripe.stripeSecret)
    ) {
      throw new ValidationException(
        `Stripe settings are invalid`,
      );
    }
  }
}

export const siteInfoRouter = router({
  publicGetSettings: publicProcedure.query(async ({ ctx }) => {
    const { domainObj } = ctx.domainData || {};

    if (!domainObj) {
      throw new NotFoundException("Domain", "current");
    }

    const exclusionFields = {
      "siteInfo.paymentMethods.stripe.stripeSecret": 0,
      "siteInfo.paymentMethods.stripe.stripeWebhookSecret": 0,
    };

    const domain = await DomainModel.findById(
      domainObj._id,
      exclusionFields,
    ).lean();

    if (!domain) {
      throw new NotFoundException("Domain", "current");
    }

    return jsonify(domain.siteInfo);
  }),

  publicGetFullSiteSetup: publicProcedure
    .input(
      z.object({
        pageId: z.string().optional(),
      }),
    )
    .query(async ({ ctx }) => {
      const { domainObj } = ctx.domainData || {};

      if (!domainObj) {
        throw new NotFoundException("Domain", "current");
      }

      const exclusionFields = {
        "siteInfo.paymentMethods.stripe.stripeSecret": 0,
        "siteInfo.paymentMethods.stripe.stripeWebhookSecret": 0,
      };

      const domain = await DomainModel.findById(
        domainObj._id,
        exclusionFields,
      ).lean();

      if (!domain) {
        throw new NotFoundException("Domain", "current");
      }

      const theme = {
        id: "default",
        name: "Default Theme",
      };

      return jsonify({
        settings: domain.siteInfo,
        theme,
      });
    }),

  getSiteInfo: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .query(async ({ ctx }) => {
      const isSiteEditor =
        ctx.user &&
        checkPermission(ctx.user.permissions, [
          UIConstants.permissions.manageSite,
        ]);

      const exclusionFields: any = {
        "siteInfo.paymentMethods.stripe.stripeSecret": 0,
      };

      if (!isSiteEditor) {
        exclusionFields["siteInfo.paymentMethods.stripe.stripeWebhookSecret"] = 0;
      }

      const domain = await DomainModel.findById(
        ctx.domainData.domainObj._id,
        exclusionFields,
      ).lean();

      if (!domain) {
        throw new NotFoundException("Domain", "current");
      }

      return jsonify(domain);
    }),

  updateSiteInfo: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageSettings]),
    )
    .input(
      getFormDataSchema({
        title: z.string().min(1).max(120).optional(),
        subtitle: z.string().min(1).max(200).optional(),
        logo: mediaWrappedFieldValidator().nullable().optional(),
        codeInjectionHead: z.string().max(50000).optional(),
        codeInjectionBody: z.string().max(50000).optional(),
        mailingAddress: z.string().min(1).max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const domain = await DomainModel.findById(ctx.domainData.domainObj._id);

      if (!domain) {
        throw new NotFoundException("Domain", "current");
      }

      if (!domain.siteInfo) {
        domain.siteInfo = {} as ISiteInfo;
      }

      Object.keys(input.data).forEach((key) => {
        (domain.siteInfo as any)[key] = (input.data as any)[key];
      });

      await DomainManager.removeFromCache(domain.toObject());
      const saved = await domain.save();

      return jsonify(saved.toObject());
    }),

  updatePaymentInfo: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageSettings]),
    )
    .input(
      getFormDataSchema({
        currencyISOCode: z.string().length(3).optional(),
        stripeKey: z.string().min(32).max(255).optional(),
        stripeSecret: z.string().min(32).max(255).optional(),
        stripeWebhookSecret: z.string().min(32).max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const domain = await DomainModel.findById(ctx.domainData.domainObj._id);

      if (!domain) {
        throw new NotFoundException("Domain", "current");
      }

      if (!domain.siteInfo || !domain.siteInfo.title) {
        throw new ValidationException("School title is not set");
      }

      if (input.data.currencyISOCode) {
        domain.siteInfo.currencyISOCode =
          input.data.currencyISOCode.toUpperCase();
      }

      if (
        input.data.stripeKey ||
        input.data.stripeSecret ||
        input.data.stripeWebhookSecret
      ) {
        if (!domain.siteInfo.paymentMethods) {
          domain.siteInfo.paymentMethods = { stripe: { type: "stripe" } };
        }

        if (!domain.siteInfo.paymentMethods.stripe) {
          domain.siteInfo.paymentMethods.stripe = { type: "stripe" };
        }

        if (input.data.stripeKey) {
          domain.siteInfo.paymentMethods.stripe.stripeKey =
            input.data.stripeKey;
        }

        if (input.data.stripeSecret) {
          domain.siteInfo.paymentMethods.stripe.stripeSecret =
            input.data.stripeSecret;
        }

        if (input.data.stripeWebhookSecret) {
          domain.siteInfo.paymentMethods.stripe.stripeWebhookSecret =
            input.data.stripeWebhookSecret;
        }
      }

      validatePaymentSettings(domain.siteInfo);

      await DomainManager.removeFromCache(domain.toObject());
      const saved = await domain.save();

      return jsonify(saved.toObject());
    }),
});
