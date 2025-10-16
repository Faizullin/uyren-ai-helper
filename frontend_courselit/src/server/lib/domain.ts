import { Log } from "@/lib/logger";
import { connectToDatabase } from "@workspace/common-logic/lib/db";
import { DomainModel, IDomainHydratedDocument } from "@workspace/common-logic/models/organization.model";
import { IDomain } from "@workspace/common-logic/models/organization.types";
import { headers } from "next/headers";
import { parseHost } from "./domain-utils";
import { BaseCacheManager, RedisNotUsedError } from "./redis";

export {
  analyzeDomain,
  cleanHost,
  extractSubdomain,
  parseHost
} from "./domain-utils";

export async function getDomainHeaders() {
  const headersList = await headers();
  const identifier = headersList.get("x-domain-identifier") || "";
  return {
    type: (headersList.get("x-domain-type") || "localhost") as
      | "localhost"
      | "subdomain"
      | "custom",
    host: headersList.get("x-domain-host") || "",
    identifier: identifier,
  };
}

export async function getDomainData(
  defaultHeaders?: Awaited<ReturnType<typeof getDomainHeaders>>,
) {
  const domainHeaders = defaultHeaders || (await getDomainHeaders());
  let domainObj: IDomain | null = null;

  try {
    if (domainHeaders.type === "subdomain" && domainHeaders.identifier) {
      domainObj = await DomainManager.getDomainByName(domainHeaders.identifier);
    } else if (domainHeaders.type === "custom" && domainHeaders.identifier) {
      domainObj = await DomainManager.getDomainByCustomDomain(
        domainHeaders.identifier,
      );
    } else if (domainHeaders.identifier === "main" || domainHeaders.type === "localhost") {
      domainObj = await DomainManager.getDomainByName("main");
    }
  } catch (error) {
    console.warn("[getDomainData] Domain lookup failed:", error);
  }

  return { headers: domainHeaders, domainObj };
}

export class DomainManager extends BaseCacheManager {
  private static readonly CACHE_PREFIX = "domain:";
  private static readonly MANAGER_NAME = "DomainManager";

  private static formatDomainForClient(domain: IDomainHydratedDocument) {
    const serialized = domain.toJSON();

    // If no siteInfo or paymentMethods, return domain as-is (no secrets to remove)
    if (!serialized.siteInfo?.paymentMethods) {
      return serialized;
    }

    // Clone the domain and siteInfo to avoid mutations
    const { siteInfo, ...rest } = serialized;
    const safePaymentMethods = { ...siteInfo?.paymentMethods };

    // Remove sensitive Stripe data if it exists
    if (safePaymentMethods?.stripe) {
      const { stripeSecret, stripeWebhookSecret, ...safeStripe } = safePaymentMethods.stripe;
      safePaymentMethods.stripe = safeStripe as any;
    }

    return { ...rest, siteInfo: { ...siteInfo, paymentMethods: safePaymentMethods } } as IDomainHydratedDocument;
  }

  static async getDomainByHost(host: string) {
    const { cleanHost: clean, subdomain } = parseHost(host);
    if (!clean) return null;

    if (subdomain) {
      const domain = await this.getDomainByName(subdomain);
      if (domain) return domain;
    }
    return await this.getDomainByCustomDomain(clean);
  }

  static async getDomainByName(name: string) {
    const cacheKey = `${this.CACHE_PREFIX}name:${name}`;

    return await this.handleRedisOperation(
      async () => {
        const cached = await this.getFromCache<IDomainHydratedDocument>(cacheKey, this.MANAGER_NAME);
        if (cached) {
          return this.formatDomainForClient(cached);
        }
        throw new RedisNotUsedError(this.MANAGER_NAME);
      },
      async () => {
        await connectToDatabase();
        const domain = await DomainModel.findOne({ name });
        if (domain) {
          await this.cache(domain);
          return this.formatDomainForClient(domain);
        }
        return null;
      }
    );
  }

  static async getDomainByCustomDomain(customDomain: string) {
    const cacheKey = `${this.CACHE_PREFIX}custom:${customDomain}`;
    return await this.handleRedisOperation(
      async () => {
        const cached = await this.getFromCache<IDomainHydratedDocument>(cacheKey, this.MANAGER_NAME);
        if (cached) {
          return this.formatDomainForClient(cached);
        }
        throw new RedisNotUsedError(this.MANAGER_NAME);
      },
      async () => {
        await connectToDatabase();
        const domain = await DomainModel.findOne({ customDomain });
        if (domain) {
          await this.cache(domain);
          return this.formatDomainForClient(domain);
        }
        return null;
      }
    );
  }

  private static async cache(domain: IDomainHydratedDocument) {
    try {
      const promises = [];
      if (domain.name) {
        promises.push(
          this.setCache(
            `${this.CACHE_PREFIX}name:${domain.name}`,
            domain,
            undefined,
            this.MANAGER_NAME,
          )
        );
      }
      if (domain.customDomain) {
        promises.push(
          this.setCache(
            `${this.CACHE_PREFIX}custom:${domain.customDomain}`,
            domain,
            undefined,
            this.MANAGER_NAME
          )
        );
      }
      await Promise.all(promises);
    } catch (error) {
      if (error instanceof RedisNotUsedError) {
        return;
      }
      Log.error(`[${this.MANAGER_NAME}] Redis caching failed:`, error as Error);
    }
  }


  static async removeFromCache(domain: IDomainHydratedDocument) {
    const keys = [];
    if (domain.name) keys.push(`${this.CACHE_PREFIX}name:${domain.name}`);
    if (domain.customDomain)
      keys.push(`${this.CACHE_PREFIX}custom:${domain.customDomain}`);

    try {
      await this.deleteFromCache(keys, this.MANAGER_NAME);
    } catch (error) {
      if (error instanceof RedisNotUsedError) {
        return;
      }
      Log.error(`[${this.MANAGER_NAME}] Cache removal failed:`, error as Error);
    }
  }
}

export default DomainManager;
