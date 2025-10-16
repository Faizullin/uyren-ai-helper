import { authOptions } from "@/lib/auth/options";
import { getDomainData } from "@/server/lib/domain";
import { initTRPC } from "@trpc/server";
import { getServerSession } from "next-auth";
import superjson from "superjson";
import z from "zod";

export async function createTRPCContext() {
  const session = await getServerSession(authOptions);
  const domainData = await getDomainData();
  return {
    session,
    domainData,
  };
}
type Context = Awaited<ReturnType<typeof createTRPCContext>>;

export const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => {
    // Handle different error types with proper formatting
    if (error.code === "BAD_REQUEST") {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError:
            error.cause instanceof z.ZodError ? error.cause.issues : null,
          code: error.code,
          message: error.message,
          name: "ValidationError",
          stack:
            process.env.NODE_ENV === "development" ? error.stack : undefined,
        },
      };
    }

    if (error.code === "UNAUTHORIZED") {
      return {
        ...shape,
        data: {
          ...shape.data,
          code: error.code,
          message: error.message,
          name: "AuthenticationError",
          redirectTo: "/auth/sign-in",
          stack:
            process.env.NODE_ENV === "development" ? error.stack : undefined,
        },
      };
    }

    if (error.code === "FORBIDDEN") {
      return {
        ...shape,
        data: {
          ...shape.data,
          code: error.code,
          message: error.message,
          name: "AuthorizationError",
          redirectTo: "/auth/sign-in",
          stack:
            process.env.NODE_ENV === "development" ? error.stack : undefined,
        },
      };
    }

    // Default error formatting
    return {
      ...shape,
      data: {
        ...shape.data,
        code: error.code,
        message: error.message,
        name: error.name || "UnknownError",
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
    };
  },
});

export const router = t.router;
export const rootProcedure = t.procedure;
