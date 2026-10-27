import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission, notFound } from "./lib/auth";
import { audit } from "./lib/audit";
import { clean } from "./lib/text";

const status = v.union(v.literal("new"), v.literal("under_review"), v.literal("approved"), v.literal("in_production"), v.literal("scheduled"), v.literal("completed"));
const input = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  propertyId: v.optional(v.id("properties")),
  platform: v.optional(v.string()),
  contentType: v.optional(v.string()),
  priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "ideas.read");
    const rows = await ctx.db.query("marketingIdeas").collect();
    return await Promise.all(
      rows.sort((a, b) => a.order - b.order).map(async (i) => ({
        ...i,
        creatorName: (await ctx.db.get(i.createdBy))?.name ?? "Unknown",
        propertyName: i.propertyId ? (await ctx.db.get(i.propertyId))?.name : undefined,
      })),
    );
  },
});

export const create = mutation({
  args: { data: input },
  handler: async (ctx, { data }) => {
    const user = await requirePermission(ctx, "ideas.write");
    const title = data.title.trim();
    if (!title) throw new ConvexError("Title is required.");
    const id = await ctx.db.insert("marketingIdeas", {
      ...data, title, description: clean(data.description), status: "new", order: Date.now(),
      createdBy: user._id, updatedBy: user._id, updatedAt: Date.now(), version: 1,
    });
    await audit(ctx, user._id, "create", "marketingIdeas", id, `Added idea "${title}"`);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("marketingIdeas"), data: input },
  handler: async (ctx, { id, data }) => {
    const user = await requirePermission(ctx, "ideas.write");
    const i = await ctx.db.get(id);
    if (!i) throw notFound("Idea");
    await ctx.db.patch(id, { ...data, title: data.title.trim() || i.title, description: clean(data.description), updatedBy: user._id, updatedAt: Date.now(), version: i.version + 1 });
  },
});

export const move = mutation({
  args: { id: v.id("marketingIdeas"), status, order: v.optional(v.number()) },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "ideas.write");
    const i = await ctx.db.get(a.id);
    if (!i) throw notFound("Idea");
    // Approval is a director/admin-or-marketing-lead decision; any marketing user may move cards,
    // but every status change is audited.
    await ctx.db.patch(a.id, { status: a.status, order: a.order ?? Date.now(), updatedBy: user._id, updatedAt: Date.now(), version: i.version + 1 });
    if (a.status !== i.status) await audit(ctx, user._id, "move", "marketingIdeas", a.id, `"${i.title}": ${i.status} → ${a.status}`);
  },
});

export const remove = mutation({
  args: { id: v.id("marketingIdeas") },
  handler: async (ctx, { id }) => {
    const user = await requirePermission(ctx, "ideas.write");
    const i = await ctx.db.get(id);
    if (!i) return;
    await ctx.db.delete(id);
    await audit(ctx, user._id, "delete", "marketingIdeas", id, `Deleted idea "${i.title}"`);
  },
});

/** Convert an approved idea into a draft campaign or a draft post. */
export const convert = mutation({
  args: { id: v.id("marketingIdeas"), to: v.union(v.literal("campaign"), v.literal("post")) },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "ideas.write", "campaigns.write");
    const i = await ctx.db.get(a.id);
    if (!i) throw notFound("Idea");
    if (i.status !== "approved") throw new ConvexError("Only approved ideas can be converted.");
    const now = Date.now();
    let targetId: string;
    if (a.to === "campaign") {
      targetId = await ctx.db.insert("marketingCampaigns", {
        name: i.title, description: i.description, propertyId: i.propertyId, status: "planning",
        platforms: i.platform ? [i.platform] : [], tasks: [], ownerId: user._id,
        createdBy: user._id, updatedBy: user._id, updatedAt: now, version: 1,
      });
    } else {
      targetId = await ctx.db.insert("socialPosts", {
        caption: [i.title, i.description].filter(Boolean).join("\n\n"), hashtags: [], accountIds: [], mediaStorageIds: [],
        propertyId: i.propertyId, timezone: "Africa/Johannesburg", status: "draft",
        createdBy: user._id, updatedBy: user._id, updatedAt: now, version: 1,
      });
    }
    await ctx.db.patch(i._id, { status: "in_production", updatedBy: user._id, updatedAt: now, version: i.version + 1 });
    await audit(ctx, user._id, "convert", "marketingIdeas", i._id, `Converted "${i.title}" into a ${a.to}`);
    return { to: a.to, id: targetId };
  },
});
