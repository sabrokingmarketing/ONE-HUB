import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireUser, getActiveUser } from "./lib/auth";

export const list = query({
  args: { unreadOnly: v.optional(v.boolean()), type: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const user = await requireUser(ctx);
    const q = a.unreadOnly
      ? ctx.db.query("notifications").withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("readAt", undefined))
      : ctx.db.query("notifications").withIndex("by_user", (q) => q.eq("userId", user._id));
    const rows = await q.order("desc").take(100);
    return a.type ? rows.filter((r) => r.type === a.type) : rows;
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getActiveUser(ctx);
    if (!user) return 0;
    const rows = await ctx.db.query("notifications").withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("readAt", undefined)).take(100);
    return rows.length;
  },
});

export const markRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const n = await ctx.db.get(id);
    if (n && n.userId === user._id && !n.readAt) await ctx.db.patch(id, { readAt: Date.now() });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query("notifications").withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("readAt", undefined)).take(500);
    const now = Date.now();
    for (const r of rows) await ctx.db.patch(r._id, { readAt: now });
  },
});

export const preferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const p = await ctx.db.query("notificationPreferences").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    return p ?? { disabledTypes: [], emailFallback: false, push: false };
  },
});

export const savePreferences = mutation({
  args: { disabledTypes: v.array(v.string()), emailFallback: v.boolean(), push: v.boolean() },
  handler: async (ctx, a) => {
    const user = await requireUser(ctx);
    const p = await ctx.db.query("notificationPreferences").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
    if (p) await ctx.db.patch(p._id, a);
    else await ctx.db.insert("notificationPreferences", { userId: user._id, ...a });
  },
});
