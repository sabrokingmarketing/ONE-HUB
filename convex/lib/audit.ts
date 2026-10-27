import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export async function audit(
  ctx: MutationCtx,
  actorId: Id<"users"> | undefined,
  action: string,
  entity: string,
  entityId: string | undefined,
  summary: string,
) {
  await ctx.db.insert("auditLogs", { actorId, action, entity, entityId, summary, at: Date.now() });
}
