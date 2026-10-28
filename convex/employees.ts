import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission, conflictError, notFound } from "./lib/auth";
import { audit } from "./lib/audit";
import { notify, usersWithRoles } from "./lib/queue";
import { clean, emailKey, isEmail, searchText } from "./lib/text";

const employmentStatus = v.union(v.literal("active"), v.literal("on_leave"), v.literal("terminated"));

export const employeeInput = v.object({
  firstName: v.string(),
  lastName: v.string(),
  email: v.optional(v.string()),
  phone: v.optional(v.string()),
  department: v.optional(v.string()),
  jobTitle: v.optional(v.string()),
  office: v.optional(v.string()),
  manager: v.optional(v.string()),
  employmentStatus: v.optional(employmentStatus),
  startDate: v.optional(v.string()),
  notes: v.optional(v.string()),
});
type EmployeeInput = typeof employeeInput.type;

function normalise(i: EmployeeInput) {
  const firstName = i.firstName.trim();
  const lastName = i.lastName.trim();
  if (!firstName || !lastName) throw new ConvexError("First and last name are required.");
  const email = clean(i.email)?.toLowerCase();
  if (email && !isEmail(email)) throw new ConvexError(`"${email}" is not a valid email address.`);
  if (i.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(i.startDate.trim())) throw new ConvexError("Start date must be YYYY-MM-DD.");
  const d = {
    firstName,
    lastName,
    email,
    emailKey: emailKey(email),
    phone: clean(i.phone),
    department: clean(i.department),
    jobTitle: clean(i.jobTitle),
    office: clean(i.office),
    manager: clean(i.manager),
    employmentStatus: i.employmentStatus ?? ("active" as const),
    startDate: clean(i.startDate),
    notes: clean(i.notes),
  };
  return { ...d, searchText: searchText(firstName, lastName, email, d.phone, d.department, d.jobTitle, d.office) };
}

async function findDuplicate(ctx: QueryCtx, key: string | undefined, excludeId?: Id<"employees">) {
  if (!key) return null;
  const rows = await ctx.db.query("employees").withIndex("by_emailKey", (q) => q.eq("emailKey", key)).collect();
  return rows.find((r) => r._id !== excludeId) ?? null;
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    department: v.optional(v.string()),
    archived: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    await requirePermission(ctx, "employees.read");
    const term = a.search?.trim();
    if (term) {
      return await ctx.db
        .query("employees")
        .withSearchIndex("search", (q) => {
          const s = q.search("searchText", term.toLowerCase());
          return a.archived ? s : s.eq("archivedAt", undefined);
        })
        .paginate(a.paginationOpts);
    }
    if (a.department) {
      return await ctx.db
        .query("employees")
        .withIndex("by_department", (q) => q.eq("department", a.department))
        .filter((q) => (a.archived ? q.neq(q.field("archivedAt"), undefined) : q.eq(q.field("archivedAt"), undefined)))
        .paginate(a.paginationOpts);
    }
    return await ctx.db
      .query("employees")
      .withIndex("by_archived", (q) => (a.archived ? q.gt("archivedAt", 0) : q.eq("archivedAt", undefined)))
      .order("desc")
      .paginate(a.paginationOpts);
  },
});

export const departments = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "employees.read", "announcements.send");
    const rows = await ctx.db.query("employees").withIndex("by_archived", (q) => q.eq("archivedAt", undefined)).collect();
    const counts = new Map<string, number>();
    for (const r of rows) if (r.department) counts.set(r.department, (counts.get(r.department) ?? 0) + 1);
    return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { id: v.id("employees") },
  handler: async (ctx, { id }) => {
    await requirePermission(ctx, "employees.read");
    const e = await ctx.db.get(id);
    if (!e) return null;
    const [creator, updater] = await Promise.all([ctx.db.get(e.createdBy), ctx.db.get(e.updatedBy)]);
    const imageUrl = e.imageStorageId ? await ctx.storage.getUrl(e.imageStorageId) : null;
    const history = await ctx.db
      .query("auditLogs")
      .withIndex("by_entity", (q) => q.eq("entity", "employees").eq("entityId", id))
      .order("desc")
      .take(20);
    return { ...e, imageUrl, createdByName: creator?.name ?? "Unknown", updatedByName: updater?.name ?? "Unknown", history };
  },
});

export const create = mutation({
  args: { data: employeeInput },
  handler: async (ctx, { data }) => {
    const user = await requirePermission(ctx, "employees.write");
    const n = normalise(data);
    const dup = await findDuplicate(ctx, n.emailKey);
    if (dup) throw new ConvexError({ code: "DUPLICATE", message: `${dup.firstName} ${dup.lastName} already uses this email.` });
    const id = await ctx.db.insert("employees", { ...n, createdBy: user._id, updatedBy: user._id, updatedAt: Date.now(), version: 1 });
    await audit(ctx, user._id, "create", "employees", id, `Added employee ${n.firstName} ${n.lastName}`);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("employees"), expectedVersion: v.number(), data: employeeInput },
  handler: async (ctx, { id, expectedVersion, data }) => {
    const user = await requirePermission(ctx, "employees.write");
    const ex = await ctx.db.get(id);
    if (!ex) throw notFound("Employee");
    if (ex.version !== expectedVersion) throw conflictError("employee");
    const n = normalise(data);
    const dup = await findDuplicate(ctx, n.emailKey, id);
    if (dup) throw new ConvexError({ code: "DUPLICATE", message: `${dup.firstName} ${dup.lastName} already uses this email.` });
    await ctx.db.patch(id, { ...n, updatedBy: user._id, updatedAt: Date.now(), version: ex.version + 1 });
    const changed = (Object.keys(n) as (keyof typeof n)[]).filter((k) => k !== "searchText" && k !== "emailKey" && ex[k] !== n[k]);
    await audit(ctx, user._id, "update", "employees", id, `Updated ${n.firstName} ${n.lastName}${changed.length ? `: ${changed.join(", ")}` : ""}`);
  },
});

export const setArchived = mutation({
  args: { id: v.id("employees"), archived: v.boolean() },
  handler: async (ctx, { id, archived }) => {
    const user = await requirePermission(ctx, "employees.write");
    const e = await ctx.db.get(id);
    if (!e) throw notFound("Employee");
    await ctx.db.patch(id, { archivedAt: archived ? Date.now() : undefined, updatedBy: user._id, updatedAt: Date.now(), version: e.version + 1 });
    await audit(ctx, user._id, archived ? "archive" : "restore", "employees", id, `${archived ? "Archived" : "Restored"} ${e.firstName} ${e.lastName}`);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "employees.write");
    return await ctx.storage.generateUploadUrl();
  },
});

export const setImage = mutation({
  args: { id: v.id("employees"), storageId: v.id("_storage") },
  handler: async (ctx, { id, storageId }) => {
    const user = await requirePermission(ctx, "employees.write");
    const e = await ctx.db.get(id);
    if (!e) throw notFound("Employee");
    const meta = await ctx.db.system.get(storageId);
    if (!meta?.contentType?.startsWith("image/") || meta.contentType === "image/svg+xml" || meta.size > 3_000_000) {
      await ctx.storage.delete(storageId);
      throw new ConvexError("Profile images must be an image under 3 MB.");
    }
    if (e.imageStorageId) await ctx.storage.delete(e.imageStorageId);
    await ctx.db.patch(id, { imageStorageId: storageId, updatedBy: user._id, updatedAt: Date.now(), version: e.version + 1 });
  },
});

const MAX_IMPORT = 500;

export const analyseImport = query({
  args: { rows: v.array(employeeInput) },
  handler: async (ctx, { rows }) => {
    await requirePermission(ctx, "employees.write");
    if (rows.length > MAX_IMPORT) throw new ConvexError(`Import at most ${MAX_IMPORT} rows at a time.`);
    const seen = new Map<string, number>();
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        const n = normalise(rows[i]);
        if (n.emailKey && seen.has(n.emailKey)) {
          out.push({ row: i, status: "duplicate_in_file" as const, message: `Same email as row ${seen.get(n.emailKey)! + 1}` });
          continue;
        }
        if (n.emailKey) seen.set(n.emailKey, i);
        const dup = await findDuplicate(ctx, n.emailKey);
        out.push(
          dup
            ? { row: i, status: "existing" as const, existingId: dup._id, existingVersion: dup.version, message: `Matches ${dup.firstName} ${dup.lastName}` }
            : { row: i, status: "new" as const },
        );
      } catch (e) {
        out.push({ row: i, status: "invalid" as const, message: e instanceof ConvexError ? String(e.data) : "Invalid row" });
      }
    }
    return out;
  },
});

export const commitImport = mutation({
  args: {
    items: v.array(
      v.object({
        action: v.union(v.literal("create"), v.literal("update")),
        data: employeeInput,
        existingId: v.optional(v.id("employees")),
        existingVersion: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { items }) => {
    const user = await requirePermission(ctx, "employees.write");
    if (items.length > MAX_IMPORT) throw new ConvexError(`Import at most ${MAX_IMPORT} rows at a time.`);
    let created = 0, updated = 0;
    const skipped: string[] = [];
    const now = Date.now();
    for (const item of items) {
      const n = normalise(item.data);
      const label = `${n.firstName} ${n.lastName}`;
      if (item.action === "update" && item.existingId) {
        const ex = await ctx.db.get(item.existingId);
        if (!ex || ex.version !== item.existingVersion) {
          skipped.push(`${label} (changed since preview)`);
          continue;
        }
        const merged = Object.fromEntries(Object.entries(n).filter(([, val]) => val !== undefined));
        await ctx.db.patch(ex._id, { ...merged, updatedBy: user._id, updatedAt: now, version: ex.version + 1 });
        updated++;
      } else {
        if (await findDuplicate(ctx, n.emailKey)) {
          skipped.push(`${label} (duplicate)`);
          continue;
        }
        await ctx.db.insert("employees", { ...n, createdBy: user._id, updatedBy: user._id, updatedAt: now, version: 1 });
        created++;
      }
    }
    await audit(ctx, user._id, "import", "employees", undefined, `Imported employees: ${created} created, ${updated} updated, ${skipped.length} skipped`);
    if (created + updated > 0) {
      const directors = (await usersWithRoles(ctx, ["director", "super_admin"])).filter((id) => id !== user._id);
      await notify(ctx, directors, {
        type: "employee",
        title: `${user.name ?? "A director"} imported ${created + updated} employee records`,
        link: "/directors/employees",
      });
    }
    return { created, updated, skipped };
  },
});

export const exportAll = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "employees.write");
    const rows = await ctx.db.query("employees").withIndex("by_archived", (q) => q.eq("archivedAt", undefined)).collect();
    return rows.map((e) => ({
      firstName: e.firstName, lastName: e.lastName, email: e.email ?? "", phone: e.phone ?? "",
      department: e.department ?? "", jobTitle: e.jobTitle ?? "", office: e.office ?? "", manager: e.manager ?? "",
      employmentStatus: e.employmentStatus, startDate: e.startDate ?? "",
    }));
  },
});
