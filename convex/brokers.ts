import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requirePermission, conflictError, notFound } from "./lib/auth";
import { audit } from "./lib/audit";
import { clean, emailKey, isEmail, phoneKey, searchText } from "./lib/text";

const contactStatus = v.union(v.literal("active"), v.literal("prospect"), v.literal("inactive"));

export const brokerInput = v.object({
  fullName: v.string(),
  company: v.optional(v.string()),
  position: v.optional(v.string()),
  email: v.optional(v.string()),
  mobile: v.optional(v.string()),
  office: v.optional(v.string()),
  address: v.optional(v.string()),
  province: v.optional(v.string()),
  region: v.optional(v.string()),
  website: v.optional(v.string()),
  propertyId: v.optional(v.id("properties")),
  contactStatus: v.optional(contactStatus),
  notes: v.optional(v.string()),
  assignedTo: v.optional(v.id("users")),
});
type BrokerInput = typeof brokerInput.type;

function normalise(input: BrokerInput) {
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (!fullName) throw new ConvexError("Full name is required.");
  const email = clean(input.email)?.toLowerCase();
  if (email && !isEmail(email)) throw new ConvexError(`"${email}" is not a valid email address.`);
  const data = {
    fullName,
    company: clean(input.company),
    position: clean(input.position),
    email,
    emailKey: emailKey(email),
    mobile: clean(input.mobile),
    mobileKey: phoneKey(input.mobile),
    office: clean(input.office),
    address: clean(input.address),
    province: clean(input.province),
    region: clean(input.region),
    website: clean(input.website),
    propertyId: input.propertyId,
    contactStatus: input.contactStatus ?? ("active" as const),
    notes: clean(input.notes),
    assignedTo: input.assignedTo,
  };
  return { ...data, searchText: searchText(data.fullName, data.company, data.email, data.mobile, data.region, data.province) };
}

async function findDuplicates(ctx: QueryCtx, d: { emailKey?: string; mobileKey?: string }, excludeId?: Id<"brokers">) {
  const out: Doc<"brokers">[] = [];
  if (d.emailKey) {
    out.push(...(await ctx.db.query("brokers").withIndex("by_emailKey", (q) => q.eq("emailKey", d.emailKey)).collect()));
  }
  if (d.mobileKey) {
    out.push(...(await ctx.db.query("brokers").withIndex("by_mobileKey", (q) => q.eq("mobileKey", d.mobileKey)).collect()));
  }
  const seen = new Set<string>();
  return out.filter((b) => b._id !== excludeId && !seen.has(b._id) && seen.add(b._id));
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    archived: v.optional(v.boolean()),
    propertyId: v.optional(v.id("properties")),
  },
  handler: async (ctx, a) => {
    await requirePermission(ctx, "brokers.read");
    const term = a.search?.trim();
    if (term) {
      return await ctx.db
        .query("brokers")
        .withSearchIndex("search", (q) => {
          const s = q.search("searchText", term.toLowerCase());
          return a.archived ? s : s.eq("archivedAt", undefined);
        })
        .filter((q) => (a.archived ? q.neq(q.field("archivedAt"), undefined) : true))
        .paginate(a.paginationOpts);
    }
    if (a.propertyId) {
      return await ctx.db
        .query("brokers")
        .withIndex("by_property", (q) => q.eq("propertyId", a.propertyId))
        .filter((q) => (a.archived ? q.neq(q.field("archivedAt"), undefined) : q.eq(q.field("archivedAt"), undefined)))
        .order("desc")
        .paginate(a.paginationOpts);
    }
    return await ctx.db
      .query("brokers")
      .withIndex("by_archived", (q) => (a.archived ? q.gt("archivedAt", 0) : q.eq("archivedAt", undefined)))
      .order("desc")
      .paginate(a.paginationOpts);
  },
});

export const get = query({
  args: { id: v.id("brokers") },
  handler: async (ctx, { id }) => {
    await requirePermission(ctx, "brokers.read");
    const b = await ctx.db.get(id);
    if (!b) return null;
    const [creator, updater, property, assignee] = await Promise.all([
      ctx.db.get(b.createdBy),
      ctx.db.get(b.updatedBy),
      b.propertyId ? ctx.db.get(b.propertyId) : null,
      b.assignedTo ? ctx.db.get(b.assignedTo) : null,
    ]);
    const history = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) => q.eq("entity", "brokers").eq("entityId", id))
      .order("desc")
      .take(20);
    return {
      ...b,
      createdByName: creator?.name ?? "Unknown",
      updatedByName: updater?.name ?? "Unknown",
      propertyName: property?.name,
      assignedToName: assignee?.name,
      history,
    };
  },
});

export const checkDuplicates = query({
  args: { email: v.optional(v.string()), mobile: v.optional(v.string()), excludeId: v.optional(v.id("brokers")) },
  handler: async (ctx, a) => {
    await requirePermission(ctx, "brokers.read");
    const dups = await findDuplicates(ctx, { emailKey: emailKey(a.email), mobileKey: phoneKey(a.mobile) }, a.excludeId);
    return dups.map((d) => ({ _id: d._id, fullName: d.fullName, company: d.company, archived: !!d.archivedAt }));
  },
});

export const create = mutation({
  args: { data: brokerInput, allowDuplicate: v.optional(v.boolean()) },
  handler: async (ctx, { data, allowDuplicate }) => {
    const user = await requirePermission(ctx, "brokers.write");
    const n = normalise(data);
    if (!allowDuplicate) {
      const dups = await findDuplicates(ctx, n);
      if (dups.length) {
        throw new ConvexError({ code: "DUPLICATE", message: `A broker with this email or mobile already exists: ${dups[0].fullName}.`, ids: dups.map((d) => d._id) });
      }
    }
    const now = Date.now();
    const id = await ctx.db.insert("brokers", { ...n, createdBy: user._id, updatedBy: user._id, updatedAt: now, version: 1 });
    await audit(ctx, user._id, "create", "brokers", id, `Added broker ${n.fullName}`);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("brokers"), expectedVersion: v.number(), data: brokerInput },
  handler: async (ctx, { id, expectedVersion, data }) => {
    const user = await requirePermission(ctx, "brokers.write");
    const existing = await ctx.db.get(id);
    if (!existing) throw notFound("Broker");
    if (existing.version !== expectedVersion) throw conflictError("broker");
    const n = normalise(data);
    const dups = await findDuplicates(ctx, n, id);
    if (dups.length) throw new ConvexError({ code: "DUPLICATE", message: `Another broker already uses this email or mobile: ${dups[0].fullName}.` });
    await ctx.db.patch(id, { ...n, updatedBy: user._id, updatedAt: Date.now(), version: existing.version + 1 });
    const changed = (Object.keys(n) as (keyof typeof n)[]).filter((k) => k !== "searchText" && !k.endsWith("Key") && existing[k] !== n[k]);
    await audit(ctx, user._id, "update", "brokers", id, `Updated ${n.fullName}${changed.length ? `: ${changed.join(", ")}` : ""}`);
  },
});

export const setArchived = mutation({
  args: { id: v.id("brokers"), archived: v.boolean() },
  handler: async (ctx, { id, archived }) => {
    const user = await requirePermission(ctx, "brokers.write");
    const b = await ctx.db.get(id);
    if (!b) throw notFound("Broker");
    await ctx.db.patch(id, { archivedAt: archived ? Date.now() : undefined, updatedBy: user._id, updatedAt: Date.now(), version: b.version + 1 });
    await audit(ctx, user._id, archived ? "archive" : "restore", "brokers", id, `${archived ? "Archived" : "Restored"} ${b.fullName}`);
  },
});

/** Contact card safe to share externally — never includes internal notes. */
export const shareCard = query({
  args: { id: v.id("brokers") },
  handler: async (ctx, { id }) => {
    await requirePermission(ctx, "brokers.read");
    const b = await ctx.db.get(id);
    if (!b) return null;
    return { fullName: b.fullName, company: b.company, position: b.position, email: b.email, mobile: b.mobile, office: b.office, address: b.address, website: b.website };
  },
});

// ---------- Import / export ----------

const MAX_IMPORT = 500;

export const analyseImport = query({
  args: { rows: v.array(brokerInput) },
  handler: async (ctx, { rows }) => {
    await requirePermission(ctx, "brokers.write");
    if (rows.length > MAX_IMPORT) throw new ConvexError(`Import at most ${MAX_IMPORT} rows at a time.`);
    const seenEmail = new Map<string, number>();
    const seenMobile = new Map<string, number>();
    const result = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        const n = normalise(rows[i]);
        const inFile =
          (n.emailKey && seenEmail.has(n.emailKey) ? seenEmail.get(n.emailKey) : undefined) ??
          (n.mobileKey && seenMobile.has(n.mobileKey) ? seenMobile.get(n.mobileKey) : undefined);
        if (n.emailKey) seenEmail.set(n.emailKey, i);
        if (n.mobileKey) seenMobile.set(n.mobileKey, i);
        if (inFile !== undefined) {
          result.push({ row: i, status: "duplicate_in_file" as const, message: `Same contact as row ${inFile + 1}` });
          continue;
        }
        const dups = await findDuplicates(ctx, n);
        if (dups.length) {
          result.push({ row: i, status: "existing" as const, existingId: dups[0]._id, existingVersion: dups[0].version, message: `Matches existing broker ${dups[0].fullName}` });
        } else {
          result.push({ row: i, status: "new" as const });
        }
      } catch (e) {
        result.push({ row: i, status: "invalid" as const, message: e instanceof ConvexError ? String(e.data) : "Invalid row" });
      }
    }
    return result;
  },
});

export const commitImport = mutation({
  args: {
    items: v.array(
      v.object({
        action: v.union(v.literal("create"), v.literal("update")),
        data: brokerInput,
        existingId: v.optional(v.id("brokers")),
        existingVersion: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { items }) => {
    const user = await requirePermission(ctx, "brokers.write");
    if (items.length > MAX_IMPORT) throw new ConvexError(`Import at most ${MAX_IMPORT} rows at a time.`);
    let created = 0, updated = 0;
    const skipped: string[] = [];
    const now = Date.now();
    for (const item of items) {
      const n = normalise(item.data);
      if (item.action === "update" && item.existingId) {
        const ex = await ctx.db.get(item.existingId);
        if (!ex || ex.version !== item.existingVersion) {
          skipped.push(`${n.fullName} (changed since preview)`);
          continue;
        }
        // Merge: only overwrite with non-empty imported values.
        const merged = Object.fromEntries(Object.entries(n).filter(([, val]) => val !== undefined));
        await ctx.db.patch(ex._id, { ...merged, updatedBy: user._id, updatedAt: now, version: ex.version + 1 });
        updated++;
      } else {
        if ((await findDuplicates(ctx, n)).length) {
          skipped.push(`${n.fullName} (duplicate)`);
          continue;
        }
        await ctx.db.insert("brokers", { ...n, createdBy: user._id, updatedBy: user._id, updatedAt: now, version: 1 });
        created++;
      }
    }
    await audit(ctx, user._id, "import", "brokers", undefined, `Imported brokers: ${created} created, ${updated} updated, ${skipped.length} skipped`);
    return { created, updated, skipped };
  },
});

export const exportAll = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    await requirePermission(ctx, "brokers.write");
    const rows = await ctx.db.query("brokers").collect();
    return rows
      .filter((b) => a.includeArchived || !b.archivedAt)
      .map((b) => ({
        fullName: b.fullName, company: b.company ?? "", position: b.position ?? "", email: b.email ?? "",
        mobile: b.mobile ?? "", office: b.office ?? "", address: b.address ?? "", province: b.province ?? "",
        region: b.region ?? "", website: b.website ?? "", contactStatus: b.contactStatus,
      }));
  },
});

export const logExport = mutation({
  args: { entity: v.union(v.literal("brokers"), v.literal("employees"), v.literal("leads")), count: v.number() },
  handler: async (ctx, a) => {
    const perm = a.entity === "brokers" ? "brokers.write" : a.entity === "employees" ? "employees.write" : "leads.write";
    const user = await requirePermission(ctx, perm);
    await audit(ctx, user._id, "export", a.entity, undefined, `Exported ${a.count} ${a.entity}`);
  },
});

