import { inferRouterOutputs } from "@trpc/server";
import { type AppRouter } from "./_app";

export type GeneralRouterOutputs = inferRouterOutputs<AppRouter>;
