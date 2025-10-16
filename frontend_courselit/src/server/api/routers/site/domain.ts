import {
  NotFoundException,
  ResourceExistsException,
} from "@/server/api/core/exceptions";
import {
  adminProcedure,
  publicProcedure,
} from "@/server/api/core/procedures";
import { getFormDataSchema, ListInputSchema } from "@/server/api/core/schema";
import { router } from "@/server/api/core/trpc";
import { like, paginate } from "@/server/api/core/utils";
import {
  documentIdValidator,
  documentSlugValidator,
  mediaWrappedFieldValidator,
  toSlug,
} from "@/server/api/core/validators";
import DomainManager, { parseHost } from "@/server/lib/domain";
import { jsonify } from "@workspace/common-logic/lib/response";
import { DomainModel } from "@workspace/common-logic/models/organization.model";
import { z } from "zod";

async function ensureUniqueName(name: string, excludeId?: string) {
  const existing = await DomainModel.findOne({
    name,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (existing) {
    throw new ResourceExistsException("Domain", "name", name);
  }
}

async function ensureUniqueCustomDomain(
  customDomain: string,
  excludeId?: string,
) {
  const existing = await DomainModel.findOne({
    customDomain,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (existing) {
    throw new ResourceExistsException(
      "Domain",
      "customDomain",
      customDomain,
    );
  }
}

export const domainRouter = router({
  list: adminProcedure
    .input(
      ListInputSchema.extend({
        filter: z
          .object({
            name: z.string().optional(),
            customDomain: z.string().optional(),
          })
          .optional(),
      }),
    )
    .query(async ({ input }) => {
      const q = input?.search?.q;
      const baseWhere: any = {
        ...(input?.filter?.name ? { name: like(input.filter.name) } : {}),
        ...(input?.filter?.customDomain
          ? { customDomain: like(input.filter.customDomain) }
          : {}),
        ...(q
          ? {
              $or: [{ name: like(q) }, { customDomain: like(q) }],
            }
          : {}),
      };

      const paginationMeta = paginate(input?.pagination);
      const orderByConfig = input?.orderBy || {
        field: "createdAt",
        direction: "desc",
      };
      const sortObject: Record<string, 1 | -1> = {
        [orderByConfig.field]: orderByConfig.direction === "asc" ? 1 : -1,
      };

      const [items, total] = await Promise.all([
        DomainModel.find(baseWhere)
          .sort(sortObject)
          .skip(paginationMeta.skip)
          .limit(paginationMeta.take)
          .lean(),
        paginationMeta.includePaginationCount
          ? DomainModel.countDocuments(baseWhere)
          : Promise.resolve(null),
      ]);

      return jsonify({
        items,
        total,
        meta: paginationMeta,
      });
    }),

  getById: adminProcedure
    .input(z.object({ id: documentIdValidator() }))
    .query(async ({ input }) => {
      const domain = await DomainModel.findById(input.id).lean();

      if (!domain) {
        throw new NotFoundException("Domain", input.id);
      }

      return jsonify(domain);
    }),

  create: adminProcedure
    .input(
      getFormDataSchema({
        name: documentSlugValidator().transform(toSlug),
        customDomain: z.string().optional(),
        siteInfo: z
          .object({
            title: z.string().optional(),
            subtitle: z.string().optional(),
            currencyISOCode: z.string().length(3).optional(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      await ensureUniqueName(input.data.name);

      if (input.data.customDomain) {
        await ensureUniqueCustomDomain(input.data.customDomain);
      }

      const domain = await DomainModel.create({
        name: input.data.name,
        customDomain: input.data.customDomain,
        orgId: ctx.user.orgId,
        siteInfo: input.data.siteInfo || {},
      });

      return jsonify(domain.toObject());
    }),

  update: adminProcedure
    .input(
      getFormDataSchema(
        {
          name: documentSlugValidator().transform(toSlug).optional(),
          customDomain: z.string().optional(),
          siteInfo: z
            .object({
              title: z.string().min(1).max(120).optional(),
              subtitle: z.string().min(1).max(200).optional(),
              logo: mediaWrappedFieldValidator().nullable().optional(),
              currencyISOCode: z.string().length(3).optional(),
              codeInjectionHead: z.string().max(50000).optional(),
              codeInjectionBody: z.string().max(50000).optional(),
              mailingAddress: z.string().min(1).max(500).optional(),
            })
            .optional(),
        },
        {
          id: documentIdValidator(),
        },
      ),
    )
    .mutation(async ({ input }) => {
      const existing = await DomainModel.findById(input.id);

      if (!existing) {
        throw new NotFoundException("Domain", input.id);
      }

      if (input.data.name) {
        await ensureUniqueName(input.data.name, input.id);
      }

      if (input.data.customDomain) {
        await ensureUniqueCustomDomain(input.data.customDomain, input.id);
      }

      await DomainManager.removeFromCache(existing.toObject());

      if (input.data.siteInfo) {
        Object.assign(existing.siteInfo, input.data.siteInfo);
        delete (input.data as any).siteInfo;
      }

      Object.keys(input.data).forEach((key) => {
        (existing as any)[key] = (input.data as any)[key];
      });

      await DomainManager.removeFromCache(existing.toObject());
      const saved = await existing.save();

      return jsonify(saved.toObject());
    }),

  delete: adminProcedure
    .input(z.object({ id: documentIdValidator() }))
    .mutation(async ({ input }) => {
      const existing = await DomainModel.findById(input.id);

      if (!existing) {
        throw new NotFoundException("Domain", input.id);
      }

      const deletedObj = existing.toObject();
      await DomainManager.removeFromCache(deletedObj);

      await DomainModel.deleteOne({ _id: input.id });

      return { success: true };
    }),

  getCurrentDomain: publicProcedure.query(async ({ ctx }) => {
    return jsonify({
      domainData: ctx.domainData,
    });
  }),

  publicGetByHost: publicProcedure
    .input(z.object({ host: z.string() }))
    .query(async ({ input }) => {
      const { cleanHost, subdomain } = parseHost(input.host);
      if (!cleanHost) {
        throw new NotFoundException("Domain", input.host);
      }

      let domain = null;

      if (subdomain) {
        domain = await DomainModel.findOne({
          name: subdomain,
        }).lean();
      }

      if (!domain) {
        domain = await DomainModel.findOne({
          customDomain: cleanHost,
        }).lean();
      }

      if (!domain) {
        throw new NotFoundException("Domain", input.host);
      }

      return jsonify(domain);
    }),
});
