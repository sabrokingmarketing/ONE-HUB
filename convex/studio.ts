import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requirePermission, notFound } from "./lib/auth";
import { audit } from "./lib/audit";
import { notify, usersWithRoles } from "./lib/queue";
import { clean, searchText } from "./lib/text";

/**
 * Marketing Studio — the marketing team's shared shelf of approved material
 * (booklets, brochures, designs, presentations, videos, brand files…).
 * Marketing team + admins upload and manage; directors browse, preview and download.
 */

export const CATEGORIES = [
  { key: "Booklets", hint: "Leasing & property booklets" },
  { key: "Brochures", hint: "Centre & portfolio brochures" },
  { key: "Designs", hint: "Artwork, banners & signage" },
  { key: "Social media", hint: "Posts, stories & ads" },
  { key: "Presentations", hint: "Pitch & investor decks" },
  { key: "Videos", hint: "Promos, walk-throughs & reels" },
  { key: "Photography", hint: "Centre & property photos" },
  { key: "Brand & logos", hint: "Logos, fonts & guidelines" },
  { key: "Templates", hint: "Editable templates" },
  { key: "Documents", hint: "Copy, reports & other files" },
] as const;
const CATEGORY_KEYS: string[] = CATEGORIES.map((c) => c.key);

const MAX_BYTES = 250 * 1024 * 1024;
const ALLOWED =
  /^(image\/|video\/|application\/pdf|application\/vnd\.openxmlformats-officedocument|application\/vnd\.ms-|application\/msword|application\/postscript|application\/illustrator|application\/vnd\.adobe|image\/vnd\.adobe|application\/x-indesign|application\/zip|application\/x-zip|text\/plain|text\/csv|font\/|application\/font|application\/octet-stream)/;

async function withUrls(ctx: { storage: { getUrl: (id: Id<"_storage">) => Promise<string | null> }; db: { get: (id: Id<"users">) => Promise<Doc<"users"> | null> } }, a: Doc<"studioAssets">) {
  const [url, coverUrl, uploader] = await Promise.all([
    ctx.storage.getUrl(a.storageId),
    a.coverStorageId ? ctx.storage.getUrl(a.coverStorageId) : Promise.resolve(null),
    ctx.db.get(a.createdBy),
  ]);
  return { ...a, url, coverUrl, uploaderName: uploader?.name ?? "Unknown" };
}

export const overview = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "studio.read");
    const rows = await ctx.db.query("studioAssets").withIndex("by_archived", (q) => q.eq("archivedAt", undefined)).collect();
    const counts: Record<string, number> = {};
    for (const r of rows) counts[r.category] = (counts[r.category] ?? 0) + 1;
    const weekAgo = Date.now() - 7 * 86400_000;
    return {
      categories: CATEGORIES.map((c) => ({ ...c, count: counts[c.key] ?? 0 })),
      total: rows.length,
      newThisWeek: rows.filter((r) => r._creationTime > weekAgo).length,
      totalBytes: rows.reduce((s, r) => s + r.size, 0),
      downloads: rows.reduce((s, r) => s + r.downloads, 0),
      collections: [...new Set(rows.map((r) => r.collection).filter((c): c is string => !!c))].sort(),
      canUpload: user.role === "super_admin" || user.role === "marketing",
    };
  },
});

export const featured = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "studio.read");
    const rows = await ctx.db.query("studioAssets").withIndex("by_featured", (q) => q.eq("featured", true).eq("archivedAt", undefined)).order("desc").take(8);
    return await Promise.all(rows.map((r) => withUrls(ctx, r)));
  },
});

export const list = query({
  args: {
    search: v.optional(v.string()),
    category: v.optional(v.string()),
    collection: v.optional(v.string()),
    propertyId: v.optional(v.id("properties")),
    kind: v.optional(v.union(v.literal("image"), v.literal("video"), v.literal("pdf"), v.literal("other"))),
    sort: v.optional(v.union(v.literal("newest"), v.literal("name"), v.literal("popular"))),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    await requirePermission(ctx, "studio.read");
    const term = a.search?.trim();
    let rows: Doc<"studioAssets">[];
    if (term) {
      rows = await ctx.db
        .query("studioAssets")
        .withSearchIndex("search", (q) => {
          const s = q.search("searchText", term.toLowerCase()).eq("archivedAt", undefined);
          return a.category ? s.eq("category", a.category) : s;
        })
        .take(120);
    } else if (a.category && !a.archived) {
      rows = await ctx.db.query("studioAssets").withIndex("by_category", (q) => q.eq("category", a.category!)).order("desc").take(400);
    } else {
      rows = await ctx.db
        .query("studioAssets")
        .withIndex("by_archived", (q) => (a.archived ? q.gt("archivedAt", 0) : q.eq("archivedAt", undefined)))
        .order("desc")
        .take(400);
    }
    const kindOf = (t: string) => (t.startsWith("image/") ? "image" : t.startsWith("video/") ? "video" : t === "application/pdf" ? "pdf" : "other");
    rows = rows.filter(
      (r) =>
        (a.archived ? !!r.archivedAt : !r.archivedAt) &&
        (!a.collection || r.collection === a.collection) &&
        (!a.propertyId || r.propertyId === a.propertyId) &&
        (!a.kind || kindOf(r.contentType) === a.kind),
    );
    if (a.sort === "name") rows.sort((x, y) => x.name.localeCompare(y.name));
    else if (a.sort === "popular") rows.sort((x, y) => y.downloads - x.downloads);
    else if (!term) rows.sort((x, y) => y._creationTime - x._creationTime);
    return await Promise.all(rows.map((r) => withUrls(ctx, r)));
  },
});

export const get = query({
  args: { id: v.id("studioAssets") },
  handler: async (ctx, { id }) => {
    await requirePermission(ctx, "studio.read");
    const a = await ctx.db.get(id);
    if (!a) return null;
    const versions: { _id: Id<"studioAssets">; versionNumber: number; _creationTime: number }[] = [];
    let prev = a.previousVersionId ? await ctx.db.get(a.previousVersionId) : null;
    while (prev && versions.length < 10) {
      versions.push({ _id: prev._id, versionNumber: prev.versionNumber, _creationTime: prev._creationTime });
      prev = prev.previousVersionId ? await ctx.db.get(prev.previousVersionId) : null;
    }
    const property = a.propertyId ? await ctx.db.get(a.propertyId) : null;
    return { ...(await withUrls(ctx, a)), propertyName: property?.name, versions };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "studio.write");
    return await ctx.storage.generateUploadUrl();
  },
});

const details = {
  name: v.string(),
  description: v.optional(v.string()),
  category: v.string(),
  collection: v.optional(v.string()),
  tags: v.array(v.string()),
  propertyId: v.optional(v.id("properties")),
  featured: v.boolean(),
};

function normalise(a: { name: string; description?: string; category: string; collection?: string; tags: string[] }) {
  if (!CATEGORY_KEYS.includes(a.category)) throw new ConvexError("Choose a valid category.");
  const name = a.name.trim();
  if (!name) throw new ConvexError("Give the file a name.");
  const tags = [...new Set(a.tags.map((t) => t.trim().toLowerCase().replace(/^#/, "")).filter(Boolean))].slice(0, 20);
  const collection = clean(a.collection);
  return {
    name,
    description: clean(a.description),
    category: a.category,
    collection,
    tags,
    searchText: searchText(name, a.description, a.category, collection, tags.join(" ")),
  };
}

async function checkFile(ctx: Parameters<typeof requirePermission>[0] & { storage: { delete: (id: Id<"_storage">) => Promise<void> } }, id: Id<"_storage">, image = false) {
  const meta = await ctx.db.system.get(id);
  if (!meta) throw new ConvexError("Upload not found — please try again.");
  const type = meta.contentType ?? "application/octet-stream";
  const ok = image ? type.startsWith("image/") && meta.size <= 10 * 1024 * 1024 : meta.size <= MAX_BYTES && ALLOWED.test(type);
  if (!ok) {
    await ctx.storage.delete(id);
    throw new ConvexError(image ? "Cover images must be an image under 10 MB." : "Unsupported file type or file larger than 250 MB.");
  }
  return { type, size: meta.size };
}

export const create = mutation({
  args: {
    ...details,
    storageId: v.id("_storage"),
    coverStorageId: v.optional(v.id("_storage")),
    replacesId: v.optional(v.id("studioAssets")),
    notifyDirectors: v.boolean(),
  },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "studio.write");
    const n = normalise(a);
    const file = await checkFile(ctx, a.storageId);
    if (a.coverStorageId) await checkFile(ctx, a.coverStorageId, true);
    let versionNumber = 1;
    if (a.replacesId) {
      const prev = await ctx.db.get(a.replacesId);
      if (!prev) throw notFound("Previous version");
      versionNumber = prev.versionNumber + 1;
      await ctx.db.patch(prev._id, { archivedAt: Date.now(), featured: false, updatedBy: user._id, updatedAt: Date.now(), version: prev.version + 1 });
    }
    const id = await ctx.db.insert("studioAssets", {
      ...n,
      propertyId: a.propertyId,
      storageId: a.storageId,
      contentType: file.type,
      size: file.size,
      coverStorageId: a.coverStorageId,
      featured: a.featured,
      downloads: 0,
      previousVersionId: a.replacesId,
      versionNumber,
      createdBy: user._id,
      updatedBy: user._id,
      updatedAt: Date.now(),
      version: 1,
    });
    await audit(ctx, user._id, "upload", "studioAssets", id, `Added "${n.name}" to Marketing Studio${versionNumber > 1 ? ` (v${versionNumber})` : ""}`);
    if (a.notifyDirectors) {
      const people = (await usersWithRoles(ctx, ["director", "super_admin"])).filter((u) => u !== user._id);
      await notify(ctx, people, {
        type: "document",
        title: `${versionNumber > 1 ? "Updated" : "New"} in Marketing Studio: ${n.name}`,
        body: n.category,
        link: `/directors/studio?asset=${id}`,
      });
    }
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("studioAssets"), expectedVersion: v.number(), ...details, coverStorageId: v.optional(v.union(v.id("_storage"), v.null())) },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "studio.write");
    const asset = await ctx.db.get(a.id);
    if (!asset) throw notFound("File");
    if (asset.version !== a.expectedVersion) throw new ConvexError({ code: "CONFLICT", message: "Someone else just edited this file. Reload and try again." });
    const n = normalise(a);
    let coverStorageId = asset.coverStorageId;
    if (a.coverStorageId !== undefined) {
      if (a.coverStorageId) await checkFile(ctx, a.coverStorageId, true);
      if (asset.coverStorageId && asset.coverStorageId !== a.coverStorageId) await ctx.storage.delete(asset.coverStorageId);
      coverStorageId = a.coverStorageId ?? undefined;
    }
    await ctx.db.patch(a.id, { ...n, propertyId: a.propertyId, featured: a.featured, coverStorageId, updatedBy: user._id, updatedAt: Date.now(), version: asset.version + 1 });
    await audit(ctx, user._id, "update", "studioAssets", a.id, `Updated "${n.name}"`);
  },
});

export const setArchived = mutation({
  args: { id: v.id("studioAssets"), archived: v.boolean() },
  handler: async (ctx, { id, archived }) => {
    const user = await requirePermission(ctx, "studio.write");
    const a = await ctx.db.get(id);
    if (!a) throw notFound("File");
    await ctx.db.patch(id, { archivedAt: archived ? Date.now() : undefined, featured: archived ? false : a.featured, updatedBy: user._id, updatedAt: Date.now(), version: a.version + 1 });
    await audit(ctx, user._id, archived ? "archive" : "restore", "studioAssets", id, `${archived ? "Archived" : "Restored"} "${a.name}"`);
  },
});

export const setFeatured = mutation({
  args: { id: v.id("studioAssets"), featured: v.boolean() },
  handler: async (ctx, { id, featured }) => {
    const user = await requirePermission(ctx, "studio.write");
    const a = await ctx.db.get(id);
    if (!a || a.archivedAt) throw notFound("File");
    await ctx.db.patch(id, { featured, updatedBy: user._id, updatedAt: Date.now(), version: a.version + 1 });
  },
});

/** Counts a download so the team can see which material is used most. */
export const recordDownload = mutation({
  args: { id: v.id("studioAssets") },
  handler: async (ctx, { id }) => {
    await requirePermission(ctx, "studio.read");
    const a = await ctx.db.get(id);
    if (!a) return;
    await ctx.db.patch(id, { downloads: a.downloads + 1 });
  },
});
