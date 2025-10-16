/**
 * Edge-compatible domain utility functions
 * These functions work in both server and edge environments (middleware)
 *
 * IMPORTANT: This file should NOT import any database connections or Redis
 * to maintain Edge Runtime compatibility for middleware usage.
 */

/**
 * Cleans a host string by removing port information
 * @param host - The host string (e.g., "example.com:3000")
 * @returns The clean host without port (e.g., "example.com") or null if invalid
 */
export function cleanHost(host: string): string | null {
  if (!host) return null;
  const clean = host.split(":")[0];
  return clean || null;
}

/**
 * Extracts subdomain from a host
 * @param host - The host string
 * @param baseDomain - The base domain to check against (defaults to localhost for dev)
 * @returns The subdomain or null if not a subdomain
 */
export function extractSubdomain(
  host: string,
  baseDomain = "localhost",
): string | null {
  const clean = cleanHost(host);
  if (!clean || clean === baseDomain) return null;

  // Handle localhost development
  if (baseDomain === "localhost" && clean === "localhost") return null;

  if (clean.endsWith(`.${baseDomain}`)) {
    return clean.replace(`.${baseDomain}`, "");
  }

  return null;
}

/**
 * Checks if a host is a custom domain (not a subdomain of base domain)
 * @param host - The host string
 * @param baseDomain - The base domain to check against
 * @returns True if it's a custom domain
 */
function isCustomDomain(host: string, baseDomain = "localhost"): boolean {
  const clean = cleanHost(host);
  if (!clean) return false;

  return clean !== baseDomain && !clean.endsWith(`.${baseDomain}`);
}

/**
 * Parses a host to extract subdomain information
 * @param host - The host string
 * @param baseDomain - The base domain to check against
 * @returns Object with cleanHost and subdomain (if any)
 */
export function parseHost(
  host: string,
  baseDomain = "localhost",
): {
  cleanHost: string | null;
  subdomain: string | null;
  isCustomDomain: boolean;
} {
  const clean = cleanHost(host);
  if (!clean) {
    return {
      cleanHost: null,
      subdomain: null,
      isCustomDomain: false,
    };
  }

  // For localhost development, treat everything as localhost
  if (clean === "localhost" || clean === "127.0.0.1") {
    return {
      cleanHost: clean,
      subdomain: null,
      isCustomDomain: false,
    };
  }

  const subdomain = extractSubdomain(clean, baseDomain);
  const customDomain = isCustomDomain(clean, baseDomain);

  return {
    cleanHost: clean,
    subdomain,
    isCustomDomain: customDomain,
  };
}

const MAIN_IDENTIFIERS = ["main", "localhost", "127.0.0.1", "85.202.193.94", "uyrenai.kz"];

/**
 * Determines domain type and identifier from host
 * @param host - The host string
 * @param baseDomain - The base domain to check against
 * @returns Object with domain type and identifier
 */
export function analyzeDomain(
  host: string,
  baseDomain = "localhost",
): {
  type: "localhost" | "subdomain" | "custom";
  identifier: string | null;
  cleanHost: string | null;
} {
  const { cleanHost, subdomain, isCustomDomain } = parseHost(host, baseDomain);

  if (!cleanHost) {
    return { type: "localhost", identifier: null, cleanHost: null };
  }

  if (cleanHost === "localhost" || cleanHost === "127.0.0.1") {
    return { type: "localhost", identifier: "main", cleanHost };
  }

  if (subdomain) {
    if (MAIN_IDENTIFIERS.includes(subdomain)) {
      return { type: "subdomain", identifier: "main", cleanHost };
    }
    return { type: "subdomain", identifier: subdomain, cleanHost };
  }

  if (isCustomDomain) {
    if (MAIN_IDENTIFIERS.includes(cleanHost)) {
      return { type: "custom", identifier: "main", cleanHost };
    }
    return { type: "custom", identifier: cleanHost, cleanHost };
  }

  return { type: "localhost", identifier: "main", cleanHost };
}

/**
 * Extracts protocol from headers (edge-compatible)
 * @param protocol - Protocol from headers (x-forwarded-proto)
 * @returns The protocol (http or https)
 */
export function getProtocol(
  protocol: string | string[] | undefined = "http",
): string {
  if (!protocol) return "http";

  const protocolStr = Array.isArray(protocol) ? protocol[0] : protocol;
  return protocolStr?.includes("https") ? "https" : "http";
}

/**
 * Constructs backend address from headers (edge-compatible)
 * @param headers - Request headers object
 * @returns The backend address as a URL
 */
export function getBackendAddress(
  headers: Record<string, unknown>,
): `${string}://${string}` {
  return `${getProtocol(
    headers["x-forwarded-proto"] as string | string[] | undefined,
  )}://${headers.host}`;
}
