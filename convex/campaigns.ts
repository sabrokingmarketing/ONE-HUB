import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission, conflictError, notFound } from "./lib/auth";
import { audit } from "./lib/audit";
import { clean, randomToken } from "./lib/text";

const status = v.union(v.literal("planning"), v.literal("active"), v.literal("paused"), v.literal("completed"), v.literal("archived"));
const input = v.object({
  name: v.string(),
  description: v.optional(v.string()),
  propertyId: v.optional(v.id("properties")),
  startDate: v.optional(v.string()),
  endDate: v.optional(v.string()),
  ownerId: v.optional(v.id("users")),
  status,
  objectives: v.optional(v.string()),
  platforms: v.array(v.string()),
  notes: v.optional(v.string()),
  tasks: v.array(v.object({ id: v.string(), title: v.string(), done: v.boolean() })),
});

function validate(i: typeof input.type) {
  const name = i.name.trim();
  if (!name) throw new ConvexError("Campaign name is required.");
  if (i.startDate && i.endDate && i.endDate < i.startDate) throw new ConvexError("End date must be after the start date.");
  return {
    ...i, name, description: clean(i.description), objectives: clean(i.objectives), notes: clean(i.notes),
    tasks: i.tasks.filter((t) => t.title.trim()).map((t) => ({ ...t, id: t.id || randomToken(4), title: t.title.trim() })),
  };
}

export const list = query({
  args: { status: v.optional(status) },
  handler: async (ctx, a) => {
    await requirePermission(ctx, "campaigns.read");
    const rows = a.status
      ? await ctx.db.query("marketingCampaigns").withIndex("by_status", (q) => q.eq("status", a.status!)).collect()
      : await ctx.db.query("marketingCampaigns").order("desc").collect();
    return await Promise.all(
      rows.map(async (c) => {
        const posts = await ctx.db.query("socialPosts").withIndex("by_campaign", (q) => q.eq("campaignId", c._id)).collect();
        const property = c.propertyId ? await ctx.db.get(c.propertyId) : null;
        const owner = c.ownerId ? await ctx.db.get(c.ownerId) : null;
        return {
          ...c,
          propertyName: property?.name,
          ownerName: owner?.name,
          postCounts: {
            total: posts.length,
            published: posts.filter((p) => p.status === "published").length,
            scheduled: posts.filter((p) => p.status === "scheduled").length,
            failed: posts.filter((p) => p.status === "failed").length,
          },
          progress: c.tasks.length ? Math.round((c.tasks.filter((t) => t.done).length / c.tasks.length) * 100) : null,
        };
      }),
    );
  },
});

export const get = query({
  args: { id: v.id("marketingCampaigns") },
  handler: async (ctx, { id }) => {
    await requirePermission(ctx, "campaigns.read");
    const c = await ctx.db.get(id);
    if (!c) return null;
    const posts = await ctx.db.query("socialPosts").withIndex("by_campaign", (q) => q.eq("campaignId", id)).collect();
    return { ...c, posts: posts.map((p) => ({ _id: p._id, caption: p.caption, status: p.status, scheduledAt: p.scheduledAt })) };
  },
});

export const create = mutation({
  args: { data: input },
  handler: async (ctx, { data }) => {
    const user = await requirePermission(ctx, "campaigns.write");
    const d = validate(data);
    const id = await ctx.db.insert("marketingCampaigns", { ...d, ownerId: d.ownerId ?? user._id, createdBy: user._id, updatedBy: user._id, updatedAt: Date.now(), version: 1 });
    await audit(ctx, user._id, "create", "marketingCampaigns", id, `Created campaign "${d.name}"`);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("marketingCampaigns"), expectedVersion: v.number(), data: input },
  handler: async (ctx, { id, expectedVersion, data }) => {
    const user = await requirePermission(ctx, "campaigns.write");
    const c = await ctx.db.get(id);
    if (!c) throw notFound("Campaign");
    if (c.version !== expectedVersion) throw conflictError("campaign");
    const d = validate(data);
    await ctx.db.patch(id, { ...d, updatedBy: user._id, updatedAt: Date.now(), version: c.version + 1 });
    await audit(ctx, user._id, "update", "marketingCampaigns", id, `Updated campaign "${d.name}"`);
  },
});

export const toggleTask = mutation({
  args: { id: v.id("marketingCampaigns"), taskId: v.string() },
  handler: async (ctx, { id, taskId }) => {
    const user = await requirePermission(ctx, "campaigns.write");
    const c = await ctx.db.get(id);
    if (!c) throw notFound("Campaign");
    await ctx.db.patch(id, { tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)), updatedBy: user._id, updatedAt: Date.now(), version: c.version + 1 });
  },
});
