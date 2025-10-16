import {
  ConflictException,
  NotFoundException,
} from "@/server/api/core/exceptions";
import {
  createDomainRequiredMiddleware,
  createPermissionMiddleware,
  protectedProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { documentIdValidator } from "@/server/api/core/validators";
import { responses } from "@/config/strings";
import { jsonify } from "@workspace/common-logic/lib/response";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { ApiKeyModel } from "@workspace/common-logic/models/api/api-key.model";
import { z } from "zod";

export const apiKeyRouter = router({
  list: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageSettings]),
    )
    .query(async ({ ctx }) => {
      const apikeys = await ApiKeyModel.find(
        { orgId: ctx.domainData.domainObj.orgId },
        {
          name: 1,
          keyId: 1,
          createdAt: 1,
          purposeKey: 1,
        },
      ).lean();

      return jsonify(apikeys);
    }),

  getById: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageSettings]),
    )
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const apikey = await ApiKeyModel.findOne({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      }).lean();

      if (!apikey) {
        throw new NotFoundException("API Key", input.id);
      }

      return jsonify(apikey);
    }),

  create: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageSettings]),
    )
    .input(
      getFormDataSchema({
        name: z.string().min(1).max(255),
        purposeKey: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existingApikey = await ApiKeyModel.findOne({
        name: input.data.name,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (existingApikey) {
        throw new ConflictException("Already exists");
      }

      const apikey = await ApiKeyModel.create({
        name: input.data.name,
        orgId: ctx.domainData.domainObj.orgId,
        purposeKey: input.data.purposeKey,
      });

      return jsonify({
        name: apikey.name,
        keyId: apikey.keyId,
        key: apikey.key,
        purposeKey: apikey.purposeKey,
      });
    }),

  delete: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageSettings]),
    )
    .input(
      z.object({
        id: documentIdValidator(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const apikey = await ApiKeyModel.findOneAndDelete({
        _id: input.id,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!apikey) {
        throw new NotFoundException("API Key", input.id);
      }

      return { success: true };
    }),

  deleteByKeyId: protectedProcedure
    .use(createDomainRequiredMiddleware())
    .use(
      createPermissionMiddleware([UIConstants.permissions.manageSettings]),
    )
    .input(
      getFormDataSchema({
        keyId: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const apikey = await ApiKeyModel.findOneAndDelete({
        keyId: input.data.keyId,
        orgId: ctx.domainData.domainObj.orgId,
      });

      if (!apikey) {
        throw new NotFoundException("API Key", input.data.keyId);
      }

      return { success: true };
    }),
});

