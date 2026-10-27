import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";

/**
 * Enqueue an email. Duplicate dedupeKeys are ignored, so retries of the
 * calling mutation (or double clicks) can never send the same email twice.
 */
export async function enqueueEmail(
  ctx: MutationCtx,
  job: { kind: string; to: string; subject: string; html: string; dedupeKey: string; announcementId?: Id<"announcements"> },
  opts: { kick?: boolean } = { kick: true },
) {
  const existing = await ctx.db
    .query("emailJobs")
    .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", job.dedupeKey))
    .first();
  if (existing) return existing._id;
  const id = await ctx.db.insert("emailJobs", {
    ...job,
    status: "queued",
    attempts: 0,
    nextAttemptAt: Date.now(),
  });
  if (opts.kick) await ctx.scheduler.runAfter(0, internal.emails.processQueue, {});
  return id;
}

export function siteUrl(path = "") {
  const base = (process.env.SITE_URL ?? "http://localhost:5173").replace(/\/$/, "");
  return `${base}${path}`;
}

/** Fan out an in-app notification to users, honouring each user's preferences. */
export async function notify(
  ctx: MutationCtx,
  userIds: Iterable<Id<"users">>,
  n: { type: import("../_generated/dataModel").Doc<"notifications">["type"]; title: string; body?: string; link?: string },
) {
  const seen = new Set<string>();
  for (const userId of userIds) {
    if (seen.has(userId)) continue;
    seen.add(userId);
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (prefs?.disabledTypes.includes(n.type)) continue;
    await ctx.db.insert("notifications", { userId, ...n });
  }
}

export async function usersWithRoles(ctx: MutationCtx, roles: ("super_admin" | "director" | "marketing")[]) {
  const out: Id<"users">[] = [];
  for (const role of roles) {
    const users = await ctx.db
      .query("users")
      .withIndex("by_role", (q) => q.eq("role", role))
      .collect();
    for (const u of users) if (u.status !== "suspended") out.push(u._id);
  }
  return out;
}
