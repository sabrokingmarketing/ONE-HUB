import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission, requireUser, conflictError, notFound } from "./lib/auth";
import { audit } from "./lib/audit";
import { clean, nameKey } from "./lib/text";
import { can } from "./lib/permissionMatrix";

const propertyType = v.union(
  v.literal("shopping_centre"), v.literal("office"), v.literal("industrial"), v.literal("residential"),
  v.literal("mixed_use"), v.literal("land"), v.literal("other"),
);
const input = v.object({
  name: v.string(),
  type: propertyType,
  location: v.string(),
  province: v.optional(v.string()),
  description: v.optional(v.string()),
  gla: v.optional(v.number()),
  contacts: v.optional(v.string()),
  notes: v.optional(v.string()),
});

function normalise(i: typeof input.type) {
  const name = i.name.trim();
  const location = i.location.trim();
  if (!name || !location) throw new ConvexError("Name and location are required.");
  return {
    name, nameKey: nameKey(name), type: i.type, location,
    province: clean(i.province), description: clean(i.description), gla: i.gla,
    contacts: clean(i.contacts), notes: clean(i.notes),
  };
}

/** Lightweight list for pickers — every signed-in role may read properties. */
export const options = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const rows = await ctx.db.query("properties").collect();
    return rows.filter((p) => !p.archivedAt).map((p) => ({ _id: p._id, name: p.name, type: p.type })).sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const list = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    await requirePermission(ctx, "properties.read");
    const rows = (await ctx.db.query("properties").collect()).filter((p) => a.includeArchived || !p.archivedAt);
    const withCovers = await Promise.all(rows.map(async (p) => ({ ...p, coverUrl: p.coverStorageId ? await ctx.storage.getUrl(p.coverStorageId) : null })));
    return withCovers.sort((x, y) => x.name.localeCompare(y.name));
  },
});

export const get = query({
  args: { id: v.id("properties") },
  handler: async (ctx, { id }) => {
    const user = await requirePermission(ctx, "properties.read");
    const p = await ctx.db.get(id);
    if (!p) return null;
    const [brokers, forms, documents] = await Promise.all([
      can(user, "brokers.read")
        ? ctx.db.query("brokers").withIndex("by_property", (q) => q.eq("propertyId", id)).filter((q) => q.eq(q.field("archivedAt"), undefined)).take(50)
        : Promise.resolve([]),
      ctx.db.query("leadForms").filter((q) => q.eq(q.field("propertyId"), id)).take(50),
      can(user, "documents.read")
        ? ctx.db.query("documents").filter((q) => q.and(q.eq(q.field("propertyId"), id), q.eq(q.field("archivedAt"), undefined))).take(50)
        : Promise.resolve([]),
    ]);
    return {
      ...p,
      coverUrl: p.coverStorageId ? await ctx.storage.getUrl(p.coverStorageId) : null,
      brokers: brokers.map((b) => ({ _id: b._id, fullName: b.fullName, company: b.company })),
      forms: forms.filter((f) => !f.archivedAt).map((f) => ({ _id: f._id, title: f.title, status: f.status, submissionCount: f.submissionCount })),
      documents: documents.map((d) => ({ _id: d._id, name: d.name, category: d.category })),
    };
  },
});

export const create = mutation({
  args: { data: input },
  handler: async (ctx, { data }) => {
    const user = await requirePermission(ctx, "properties.write");
    const n = normalise(data);
    const dup = await ctx.db.query("properties").withIndex("by_nameKey", (q) => q.eq("nameKey", n.nameKey)).first();
    if (dup) throw new ConvexError({ code: "DUPLICATE", message: `A property called "${dup.name}" already exists.` });
    const id = await ctx.db.insert("properties", { ...n, createdBy: user._id, updatedBy: user._id, updatedAt: Date.now(), version: 1 });
    await audit(ctx, user._id, "create", "properties", id, `Added property ${n.name}`);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("properties"), expectedVersion: v.number(), data: input },
  handler: async (ctx, { id, expectedVersion, data }) => {
    const user = await requirePermission(ctx, "properties.write");
    const p = await ctx.db.get(id);
    if (!p) throw notFound("Property");
    if (p.version !== expectedVersion) throw conflictError("property");
    const n = normalise(data);
    const dup = await ctx.db.query("properties").withIndex("by_nameKey", (q) => q.eq("nameKey", n.nameKey)).first();
    if (dup && dup._id !== id) throw new ConvexError({ code: "DUPLICATE", message: `A property called "${dup.name}" already exists.` });
    await ctx.db.patch(id, { ...n, updatedBy: user._id, updatedAt: Date.now(), version: p.version + 1 });
    await audit(ctx, user._id, "update", "properties", id, `Updated property ${n.name}`);
  },
});

export const setArchived = mutation({
  args: { id: v.id("properties"), archived: v.boolean() },
  handler: async (ctx, { id, archived }) => {
    const user = await requirePermission(ctx, "properties.write");
    const p = await ctx.db.get(id);
    if (!p) throw notFound("Property");
    await ctx.db.patch(id, { archivedAt: archived ? Date.now() : undefined, updatedBy: user._id, updatedAt: Date.now(), version: p.version + 1 });
    await audit(ctx, user._id, archived ? "archive" : "restore", "properties", id, `${archived ? "Archived" : "Restored"} ${p.name}`);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "properties.write");
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Sets (or replaces) the property's cover image. The previous image is deleted.
 * A rejected upload is deleted and reported in the result rather than thrown, because
 * throwing would roll the delete back and leave the file orphaned in storage.
 */
export const setCover = mutation({
  args: { id: v.id("properties"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }): Promise<{ error?: string }> => {
    const user = await requirePermission(ctx, "properties.write");
    const p = await ctx.db.get(id);
    if (!p) throw notFound("Property");
    const meta = await ctx.db.system.get(storageId);
    if (!meta?.contentType?.startsWith("image/") || meta.contentType === "image/svg+xml" || meta.size > 10 * 1024 * 1024) {
      await ctx.storage.delete(storageId);
      return { error: "Cover images must be a JPG, PNG or WebP under 10 MB." };
    }
    if (p.coverStorageId) await ctx.storage.delete(p.coverStorageId);
    await ctx.db.patch(id, { coverStorageId: storageId, updatedBy: user._id, updatedAt: Date.now(), version: p.version + 1 });
    await audit(ctx, user._id, "update", "properties", id, `Changed the cover image of ${p.name}`);
    return {};
  },
});

export const removeCover = mutation({
  args: { id: v.id("properties") },
  handler: async (ctx, { id }) => {
    const user = await requirePermission(ctx, "properties.write");
    const p = await ctx.db.get(id);
    if (!p) throw notFound("Property");
    if (!p.coverStorageId) return;
    await ctx.storage.delete(p.coverStorageId);
    await ctx.db.patch(id, { coverStorageId: undefined, updatedBy: user._id, updatedAt: Date.now(), version: p.version + 1 });
    await audit(ctx, user._id, "update", "properties", id, `Removed the cover image of ${p.name}`);
  },
});
