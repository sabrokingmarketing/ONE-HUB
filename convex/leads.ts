import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { leadStatus } from "./schema";
import { requirePermission, conflictError, notFound } from "./lib/auth";
import { audit } from "./lib/audit";
import { notify } from "./lib/queue";
import { clean, isEmail, searchText } from "./lib/text";

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    status: v.optional(leadStatus),
    search: v.optional(v.string()),
    formId: v.optional(v.id("leadForms")),
    mine: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "leads.read");
    const base = (() => {
      const term = a.search?.trim();
      if (term) return ctx.db.query("leads").withSearchIndex("search", (q) => q.search("searchText", term.toLowerCase()).eq("archivedAt", undefined));
      if (a.mine) return ctx.db.query("leads").withIndex("by_assignee", (q) => q.eq("assignedTo", user._id)).order("desc");
      if (a.formId) return ctx.db.query("leads").withIndex("by_form", (q) => q.eq("formId", a.formId)).order("desc");
      if (a.status) return ctx.db.query("leads").withIndex("by_status", (q) => q.eq("status", a.status!)).order("desc");
      return ctx.db.query("leads").withIndex("by_submittedAt").order("desc");
    })();
    const page = await base
      .filter((q) =>
        q.and(
          q.eq(q.field("archivedAt"), undefined),
          a.status ? q.eq(q.field("status"), a.status) : true,
        ),
      )
      .paginate(a.paginationOpts);
    const names = new Map<string, string>();
    const page2 = await Promise.all(
      page.page.map(async (l) => {
        let assignedToName: string | undefined;
        if (l.assignedTo) {
          if (!names.has(l.assignedTo)) names.set(l.assignedTo, (await ctx.db.get(l.assignedTo))?.name ?? "Unknown");
          assignedToName = names.get(l.assignedTo);
        }
        return { ...l, assignedToName };
      }),
    );
    return { ...page, page: page2 };
  },
});

export const get = query({
  args: { id: v.id("leads") },
  handler: async (ctx, { id }) => {
    await requirePermission(ctx, "leads.read");
    const l = await ctx.db.get(id);
    if (!l) return null;
    const [assignee, property, form] = await Promise.all([
      l.assignedTo ? ctx.db.get(l.assignedTo) : null,
      l.propertyId ? ctx.db.get(l.propertyId) : null,
      l.formId ? ctx.db.get(l.formId) : null,
    ]);
    const history = await ctx.db.query("auditLogs").withIndex("by_entity", (q) => q.eq("entity", "leads").eq("entityId", id)).order("desc").take(30);
    return { ...l, assignedToName: assignee?.name, propertyName: property?.name, formTitle: form?.title, history };
  },
});

export const counts = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "leads.read");
    const out: Record<string, number> = { new: 0, contacted: 0, qualified: 0, follow_up: 0, converted: 0, closed: 0 };
    for (const s of Object.keys(out)) {
      const rows = await ctx.db.query("leads").withIndex("by_status", (q) => q.eq("status", s as Doc<"leads">["status"])).collect();
      out[s] = rows.filter((l) => !l.archivedAt).length;
    }
    return out;
  },
});

export const update = mutation({
  args: {
    id: v.id("leads"),
    expectedVersion: v.number(),
    status: v.optional(leadStatus),
    notes: v.optional(v.string()),
    assignedTo: v.optional(v.union(v.id("users"), v.null())),
  },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "leads.write");
    const l = await ctx.db.get(a.id);
    if (!l) throw notFound("Lead");
    if (l.version !== a.expectedVersion) throw conflictError("lead");
    const patch: Partial<Doc<"leads">> = { updatedBy: user._id, updatedAt: Date.now(), version: l.version + 1 };
    const changes: string[] = [];
    if (a.status && a.status !== l.status) { patch.status = a.status; changes.push(`status → ${a.status}`); }
    if (a.notes !== undefined && a.notes !== l.notes) { patch.notes = clean(a.notes); changes.push("notes"); }
    if (a.assignedTo !== undefined && (a.assignedTo ?? undefined) !== l.assignedTo) {
      if (a.assignedTo) {
        const assignee = await ctx.db.get(a.assignedTo);
        if (!assignee?.role || assignee.role === "marketing" || assignee.status === "suspended") throw new ConvexError("Leads can only be assigned to active directors or admins.");
        changes.push(`assigned to ${assignee.name}`);
        if (assignee._id !== user._id) {
          await notify(ctx, [assignee._id], { type: "lead", title: `${user.name ?? "Someone"} assigned you a lead: ${l.name}`, link: `/leads/${l._id}` });
        }
      } else changes.push("unassigned");
      patch.assignedTo = a.assignedTo ?? undefined;
    }
    if (!changes.length) return;
    await ctx.db.patch(l._id, patch);
    await audit(ctx, user._id, "update", "leads", l._id, `${l.name}: ${changes.join(", ")}`);
  },
});

export const createManual = mutation({
  args: { name: v.string(), email: v.optional(v.string()), phone: v.optional(v.string()), company: v.optional(v.string()), source: v.string(), propertyId: v.optional(v.id("properties")), notes: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "leads.write");
    const name = a.name.trim();
    if (!name) throw new ConvexError("Name is required.");
    const email = clean(a.email)?.toLowerCase();
    if (email && !isEmail(email)) throw new ConvexError("Invalid email.");
    const now = Date.now();
    const id = await ctx.db.insert("leads", {
      source: a.source.trim() || "Manual entry", name, email, phone: clean(a.phone), company: clean(a.company),
      answers: [], consent: false, propertyId: a.propertyId, status: "new", notes: clean(a.notes),
      searchText: searchText(name, email, a.phone, a.company), submittedAt: now, updatedAt: now, updatedBy: user._id, version: 1,
    });
    await audit(ctx, user._id, "create", "leads", id, `Added lead ${name} manually`);
    return id;
  },
});

/** POPIA: archive (soft delete) a lead on request; hard delete via `erase`. */
export const archive = mutation({
  args: { id: v.id("leads") },
  handler: async (ctx, { id }) => {
    const user = await requirePermission(ctx, "leads.write");
    const l = await ctx.db.get(id);
    if (!l) throw notFound("Lead");
    await ctx.db.patch(id, { archivedAt: Date.now(), updatedBy: user._id, updatedAt: Date.now(), version: l.version + 1 });
    await audit(ctx, user._id, "archive", "leads", id, `Archived lead ${l.name}`);
  },
});

export const erase = mutation({
  args: { id: v.id("leads"), confirmName: v.string() },
  handler: async (ctx, { id, confirmName }) => {
    const user = await requirePermission(ctx, "leads.erase");
    const l = await ctx.db.get(id);
    if (!l) throw notFound("Lead");
    if (confirmName.trim() !== l.name) throw new ConvexError("Type the lead's exact name to confirm permanent deletion.");
    await ctx.db.delete(id);
    await audit(ctx, user._id, "erase", "leads", id, `Permanently erased a lead (POPIA deletion request)`);
  },
});

export const exportAll = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "leads.write");
    const rows = await ctx.db.query("leads").withIndex("by_submittedAt").order("desc").collect();
    return rows
      .filter((l) => !l.archivedAt)
      .map((l) => ({
        name: l.name, email: l.email ?? "", phone: l.phone ?? "", company: l.company ?? "", source: l.source,
        status: l.status, submitted: new Date(l.submittedAt).toISOString(), consent: l.consent ? "yes" : "no",
      }));
  },
});
