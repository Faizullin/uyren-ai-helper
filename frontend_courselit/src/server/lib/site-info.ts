import { getDomainData } from "@/server/lib/domain";
import { cache } from "react";

/**
 * Server-side site info fetcher
 * - Uses Redis-first domain resolution with clear [DEBUG] logs
 * - Memoized per-request via React cache() to avoid duplicate Redis/DB calls
 */
export const getServerSiteInfo = cache(async () => {
  const domainData = await getDomainData();
  if (!domainData.domainObj) return undefined;
  return domainData.domainObj.siteInfo;
});
