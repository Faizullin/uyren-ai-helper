import { connectToDatabase } from "@workspace/common-logic/lib/db";
import { UIConstants } from "@workspace/common-logic/lib/ui/constants";
import { DomainModel } from "@workspace/common-logic/models/organization.model";
import { IDomain } from "@workspace/common-logic/models/organization.types";
import { IUserHydratedDocument, UserModel } from "@workspace/common-logic/models/user.model";
import { checkPermission } from "@workspace/utils";
import mongoose from "mongoose";
import { Session } from "next-auth";
import { AuthenticationException, AuthorizationException, NotFoundException } from "./exceptions";
import { rootProcedure, t } from "./trpc";

// Base middleware for role-based access control
export const createPermissionMiddleware = <T = any>(
  allowedPermissions: string[],
) => {
  return async ({
    ctx,
    next,
  }: {
    ctx: T;
    next: (opts: { ctx: T }) => Promise<any>;
  }) => {
    const userPermissions = (ctx as any).user!.permissions;
    if (!checkPermission(userPermissions, allowedPermissions)) {
      throw new AuthorizationException(
        `Access denied. Required permissions: ${allowedPermissions.join(", ")}`,
      );
    }
    return next({
      ctx,
    });
  };
};

const createRoleMiddleware = (allowedRoles: string[]) => {
  return t.middleware(async ({ ctx, next }) => {
    const userRoles = ctx.session!.user.roles;
    if (!checkPermission(userRoles, allowedRoles)) {
      throw new AuthorizationException(
        `Access denied. Required roles: ${allowedRoles.join(", ")}`,
      );
    }
    return next({
      ctx,
    });
  });
};

const assertDomainExist = async (ctx: MainContextType) => {
  const domainObj = await DomainModel.findById(ctx.domainData.domainObj._id).lean();
  if (!domainObj) {
    throw new NotFoundException("Domain", ctx.domainData.domainObj._id);
  }
  return domainObj;
};

export const createDomainRequiredMiddleware = <T = any>() => {
  return t.middleware(async ({ ctx, next }) => {
    const domainObj = await assertDomainExist(ctx as MainContextType);
    return next({
      ctx: {
        ...ctx,
        domainData: {
          ...ctx.domainData,
          domainObj,
        },
      },
    });
  });
};

export const publicProcedure = rootProcedure;
export const protectedProcedure = rootProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new AuthenticationException("User not authenticated");
    }
    await connectToDatabase();
    let user: IUserHydratedDocument | null = null;
    try {
      user = await UserModel.findById(ctx.session.user.id).lean() as IUserHydratedDocument;
    } catch (error) {
      console.error("[protectedProcedure] Error finding user:", error);
    }
    if (!user) {
      throw new AuthenticationException("User not found");
    }
    return await next({
      ctx: {
        ...ctx,
        session: ctx.session!,
        user,
      },
    });
  }),
);
export const adminProcedure = protectedProcedure.use(
  createRoleMiddleware([UIConstants.roles.admin]),
);
export const teacherProcedure = protectedProcedure.use(
  createRoleMiddleware([UIConstants.roles.admin, UIConstants.roles.instructor]),
);

export type MainContextType = {
  user: IUserHydratedDocument;
  session: Session | null;
  domainData: {
    domainObj: IDomain & {
      _id: mongoose.Types.ObjectId;
    };
    headers: any;
  };
};
