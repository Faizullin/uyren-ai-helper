import { analyzeDomain } from "@/server/lib/domain-utils";
import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

/**
 * Domain Resolution & Authentication Middleware
 *
 * Resolves domain information for each request and injects it into headers
 * for downstream consumption by tRPC context and other parts of the application.
 * Also handles authentication for protected routes.
 *
 * Features:
 * - Multi-tenant domain resolution
 * - Custom domain support
 * - Subdomain detection
 * - Edge runtime compatible (no database access)
 * - Protected route authentication
 *
 * Note: Database lookups are deferred to server components/API routes
 * to maintain Edge Runtime compatibility.
 */

// Define protected URL patterns
const PROTECTED_ROUTES = ["/dashboard", "/profile", "/settings"];

// Define public routes that should not require authentication
const PUBLIC_ROUTES = [
  "/",
  "/auth/sign-in",
  "/auth/sign-up",
  "/api/auth",
  "/forgot-password",
  "/reset-password",
];

function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some((route) => pathname.startsWith(route));
}

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/"),
  );
}

export async function middleware(req: NextRequest) {
  const hostname = req.headers.get("host");
  const pathname = req.nextUrl.pathname;

  // Create response to modify headers
  const response = NextResponse.next();

  // Domain resolution logic
  if (hostname) {
    try {
      const domainInfo = analyzeDomain(hostname);

      response.headers.set("x-domain-type", domainInfo.type);
      response.headers.set("x-domain-host", domainInfo.cleanHost || "");
      response.headers.set("x-domain-identifier", domainInfo.identifier!);
      // console.log("[MIDDLEWARE] Domain analysis:", {
      //   "x-domain-type": domainInfo.type,
      //   "x-domain-host": domainInfo.cleanHost || "",
      //   "x-domain-identifier": domainInfo.identifier!,
      // });
    } catch (error) {
      console.error("[MIDDLEWARE] Error analyzing domain:", error);
    }
  }

  // Authentication logic for protected routes
  if (isProtectedRoute(pathname) && !isPublicRoute(pathname)) {
    try {
      const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!token) {
        const loginUrl = new URL("/auth/sign-in", req.url);
        loginUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(loginUrl);
      }
    } catch (error) {
      console.error("[MIDDLEWARE] Authentication error:", error);
      const loginUrl = new URL("/auth/sign-in", req.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. /api routes (except /api/auth)
     * 2. /_next (Next.js internals)
     * 3. all root files inside /public (e.g. /favicon.ico)
     * 4. static files with extensions
     * 5. trpc routes
     */
    "/((?!api(?!/auth)|_next/static|_next/image|favicon.ico|.*\\..*|public).*)",
    "/",
    "/api/(.*)",
    "/dashboard/(.*)",
    "/admin/(.*)",
    "/profile/(.*)",
    "/settings/(.*)",
  ],
};
