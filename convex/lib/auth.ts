import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { can, type Permission } from "./permissionMatrix";

export type ActiveUser = Doc<"users"> & { role: NonNullable<Doc<"users">["role"]> };

/** Returns the signed-in, active, role-bearing user or null. */
export async function getActiveUser(ctx: QueryCtx | MutationCtx): Promise<ActiveUser | null> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  const user = await ctx.db.get(userId);
  if (!user || !user.role || user.status === "suspended") return null;
  return user as ActiveUser;
}

export async function requireUser(ctx: QueryCtx | MutationCtx): Promise<ActiveUser> {
  const user = await getActiveUser(ctx);
  if (!user) throw new ConvexError({ code: "UNAUTHENTICATED", message: "Please sign in." });
  return user;
}

export async function requirePermission(
  ctx: QueryCtx | MutationCtx,
  ...anyOf: Permission[]
): Promise<ActiveUser> {
  const user = await requireUser(ctx);
  if (!anyOf.some((p) => can(user, p))) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "You do not have permission to perform this action.",
    });
  }
  return user;
}

export function conflictError(entity: string) {
  return new ConvexError({
    code: "CONFLICT",
    message: `This ${entity} was changed by someone else while you were editing. Review the latest version and try again.`,
  });
}

export function notFound(entity: string) {
  return new ConvexError({ code: "NOT_FOUND", message: `${entity} not found.` });
}
