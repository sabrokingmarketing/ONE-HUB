import type { MutationCtx, QueryCtx } from "../_generated/server";
import { emailLimits, emailMode } from "./email";

const DAY_MS = 24 * 60 * 60 * 1000;

export const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);
export const nextUtcMidnight = (t: number) => Math.floor(t / DAY_MS) * DAY_MS + DAY_MS;

/**
 * How many more emails ONE HUB may hand to Resend right now without exceeding
 * the plan's caps. In-flight ("sending") jobs count as used. Never bypasses a
 * provider limit: when a cap is reached, the rest waits for the next day.
 */
export async function quotaSnapshot(ctx: QueryCtx | MutationCtx, now = Date.now()) {
  const limits = emailLimits();
  const mode = emailMode();
  const today = utcDay(now);
  const monthStart = `${today.slice(0, 7)}-01`;
  const days = await ctx.db
    .query("emailUsage")
    .withIndex("by_day", (q) => q.gte("day", monthStart).lte("day", today))
    .collect();
  const sentToday = days.find((d) => d.day === today)?.sent ?? 0;
  const sentMonth = days.reduce((s, d) => s + d.sent, 0);
  const inFlight = (
    await ctx.db
      .query("emailJobs")
      .withIndex("by_status_next", (q) => q.eq("status", "sending"))
      .take(100)
  ).length;
  const remainingToday = limits.daily ? Math.max(0, limits.daily - sentToday - inFlight) : Infinity;
  const remainingMonth = limits.monthly ? Math.max(0, limits.monthly - sentMonth - inFlight) : Infinity;
  return {
    mode,
    limits,
    sentToday,
    sentMonth,
    inFlight,
    // "log" mode never reaches Resend, so it never consumes quota.
    remaining: mode === "log" ? Infinity : Math.min(remainingToday, remainingMonth),
    resetsAt: nextUtcMidnight(now),
  };
}

export async function recordSent(ctx: MutationCtx, now = Date.now()) {
  const day = utcDay(now);
  const row = await ctx.db
    .query("emailUsage")
    .withIndex("by_day", (q) => q.eq("day", day))
    .unique();
  if (row) await ctx.db.patch(row._id, { sent: row.sent + 1 });
  else await ctx.db.insert("emailUsage", { day, sent: 1 });
}
