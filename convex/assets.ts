import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission, notFound, type ActiveUser } from "./lib/auth";
import { can } from "./lib/permissionMatrix";
import { audit } from "./lib/audit";
import { notify, usersWithRoles } from "./lib/queue";
import { clean, searchText } from "./lib/text";
import type { Doc } from "./_generated/dataModel";

export const CATEGORIES = [
  "Corporate Branding", "Property Portfolios", "Shopping Centres", "Presentations", "Marketing Videos",
  "Animated Videos", "Campaign Assets", "Brochures", "Internal Documents", "Approved Templates",
];
const MAX_BYTES = 200 * 1024 * 1024;
const ALLOWED = /^(image\/|video\/|application\/pdf|application\/vnd\.openxmlformats-officedocument|application\/vnd\.ms-|application\/msword|text\/plain|text\/csv|application\/zip)/;

/** Directors see only assets explicitly shared with the company; marketing/admin see all. */
function visible(user: ActiveUser, a: Doc<"marketingAssets">) {
  return can(user, "library.write") || a.audience === "company";
}

export const list = query({
  args: { search: v.optional(v.string()), category: v.optional(v.string()), propertyId: v.optional(v.id("properties")), archived: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "library.read");
    const term = a.search?.trim();
    let rows: Doc<"marketingAssets">[];
    if (term) {
      rows = await ctx.db.query("marketingAssets").withSearchIndex("search", (q) => q.search("searchText", term.toLowerCase()).eq("archivedAt", undefined)).take(100);
    } else if (a.category) {
      rows = await ctx.db.query("marketingAssets").withIndex("by_category", (q) => q.eq("category", a.category!)).order("desc").take(200);
    } else {
      rows = await ctx.db.query("marketingAssets").withIndex("by_archived", (q) => (a.archived ? q.gt("archivedAt", 0) : q.eq("archivedAt", undefined))).order("desc").take(200);
    }
    rows = rows.filter((r) => visible(user, r) && (a.archived ? !!r.archivedAt : !r.archivedAt) && (!a.propertyId || r.propertyId === a.propertyId));
    return await Promise.all(
      rows.map(async (r) => ({
        ...r,
        // Signed, unguessable Convex storage URL — only returned to authorised users.
        url: await ctx.storage.getUrl(r.storageId),
        uploaderName: (await ctx.db.get(r.createdBy))?.name ?? "Unknown",
      })),
    );
  },
});

export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "library.read");
    const rows = await ctx.db.query("marketingAssets").withIndex("by_archived", (q) => q.eq("archivedAt", undefined)).order("desc").take(50);
    return rows.filter((r) => visible(user, r)).slice(0, a.limit ?? 6).map((r) => ({ _id: r._id, name: r.name, category: r.category, contentType: r.contentType, _creationTime: r._creationTime }));
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "library.write");
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    storageId: v.id("_storage"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    folder: v.optional(v.string()),
    tags: v.array(v.string()),
    propertyId: v.optional(v.id("properties")),
    audience: v.union(v.literal("marketing"), v.literal("company")),
    replacesId: v.optional(v.id("marketingAssets")),
  },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "library.write");
    const meta = await ctx.db.system.get(a.storageId);
    if (!meta) throw new ConvexError("Upload not found.");
    if (meta.size > MAX_BYTES || !ALLOWED.test(meta.contentType ?? "")) {
      await ctx.storage.delete(a.storageId);
      throw new ConvexError("Unsupported file type or file larger than 200 MB.");
    }
    const name = a.name.trim() || "Untitled";
    const tags = [...new Set(a.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
    const id = await ctx.db.insert("marketingAssets", {
      name, description: clean(a.description), storageId: a.storageId, contentType: meta.contentType ?? "application/octet-stream",
      size: meta.size, category: a.category, folder: clean(a.folder), tags, propertyId: a.propertyId, audience: a.audience,
      previousVersionId: a.replacesId, searchText: searchText(name, a.description, a.category, a.folder, tags.join(" ")),
      createdBy: user._id, updatedBy: user._id, updatedAt: Date.now(), version: 1,
    });
    if (a.replacesId) {
      const prev = await ctx.db.get(a.replacesId);
      if (prev && !prev.archivedAt) await ctx.db.patch(prev._id, { archivedAt: Date.now(), updatedBy: user._id, updatedAt: Date.now(), version: prev.version + 1 });
    }
    await audit(ctx, user._id, "upload", "marketingAssets", id, `Uploaded "${name}"${a.replacesId ? " (new version)" : ""}`);
    if (a.audience === "company") {
      const others = (await usersWithRoles(ctx, ["director"])).filter((u) => u !== user._id);
      await notify(ctx, others, { type: "document", title: `New document: ${name}`, body: a.category, link: "/directors/documents" });
    }
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("marketingAssets"),
    name: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    folder: v.optional(v.string()),
    tags: v.array(v.string()),
    propertyId: v.optional(v.id("properties")),
    audience: v.union(v.literal("marketing"), v.literal("company")),
  },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "library.write");
    const asset = await ctx.db.get(a.id);
    if (!asset) throw notFound("Asset");
    const name = a.name.trim() || asset.name;
    const tags = [...new Set(a.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
    await ctx.db.patch(a.id, {
      name, description: clean(a.description), category: a.category, folder: clean(a.folder), tags, propertyId: a.propertyId, audience: a.audience,
      searchText: searchText(name, a.description, a.category, a.folder, tags.join(" ")), updatedBy: user._id, updatedAt: Date.now(), version: asset.version + 1,
    });
    await audit(ctx, user._id, "update", "marketingAssets", a.id, `Updated "${name}"`);
  },
});

export const setArchived = mutation({
  args: { id: v.id("marketingAssets"), archived: v.boolean() },
  handler: async (ctx, { id, archived }) => {
    const user = await requirePermission(ctx, "library.write");
    const asset = await ctx.db.get(id);
    if (!asset) throw notFound("Asset");
    await ctx.db.patch(id, { archivedAt: archived ? Date.now() : undefined, updatedBy: user._id, updatedAt: Date.now(), version: asset.version + 1 });
    await audit(ctx, user._id, archived ? "archive" : "restore", "marketingAssets", id, `${archived ? "Archived" : "Restored"} "${asset.name}"`);
  },
});

export const categories = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "library.read");
    return CATEGORIES;
  },
});
