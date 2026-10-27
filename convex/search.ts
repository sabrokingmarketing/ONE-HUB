import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireUser } from "./lib/auth";
import { can } from "./lib/permissionMatrix";

/** Global search across every record type the user is authorised to see. */
export const global = query({
  args: { q: v.string() },
  handler: async (ctx, { q }) => {
    const user = await requireUser(ctx);
    const term = q.trim().toLowerCase();
    if (term.length < 2) return [];
    const groups: { group: string; items: { id: string; title: string; subtitle?: string; href: string }[] }[] = [];
    const push = (group: string, items: { id: string; title: string; subtitle?: string; href: string }[]) => items.length && groups.push({ group, items });

    if (can(user, "brokers.read")) {
      const r = await ctx.db.query("brokers").withSearchIndex("search", (s) => s.search("searchText", term).eq("archivedAt", undefined)).take(5);
      push("Brokers", r.map((b) => ({ id: b._id, title: b.fullName, subtitle: b.company, href: `/directors/brokers/${b._id}` })));
    }
    if (can(user, "employees.read")) {
      const r = await ctx.db.query("employees").withSearchIndex("search", (s) => s.search("searchText", term).eq("archivedAt", undefined)).take(5);
      push("Employees", r.map((e) => ({ id: e._id, title: `${e.firstName} ${e.lastName}`, subtitle: [e.jobTitle, e.department].filter(Boolean).join(" · "), href: `/directors/employees/${e._id}` })));
    }
    if (can(user, "leads.read")) {
      const r = await ctx.db.query("leads").withSearchIndex("search", (s) => s.search("searchText", term).eq("archivedAt", undefined)).take(5);
      push("Leads", r.map((l) => ({ id: l._id, title: l.name, subtitle: l.source, href: `/leads/${l._id}` })));
    }
    if (can(user, "forms.read")) {
      const r = (await ctx.db.query("leadForms").collect()).filter((f) => !f.archivedAt && f.title.toLowerCase().includes(term)).slice(0, 5);
      push("Lead forms", r.map((f) => ({ id: f._id, title: f.title, subtitle: `${f.submissionCount} submissions`, href: `/forms/${f._id}` })));
    }
    if (can(user, "properties.read")) {
      const r = await ctx.db.query("properties").withSearchIndex("search", (s) => s.search("name", term).eq("archivedAt", undefined)).take(5);
      push("Properties", r.map((p) => ({ id: p._id, title: p.name, subtitle: p.location, href: `/properties/${p._id}` })));
    }
    if (can(user, "documents.read")) {
      const r = await ctx.db.query("documents").withSearchIndex("search", (s) => s.search("searchText", term).eq("archivedAt", undefined)).take(5);
      push("Documents", r.map((d) => ({ id: d._id, title: d.name, subtitle: d.category, href: `/directors/documents?doc=${d._id}` })));
    }
    if (can(user, "meetings.manage") || can(user, "calendar.personal")) {
      const upcoming = await ctx.db.query("meetings").withIndex("by_startsAt", (s) => s.gte("startsAt", Date.now() - 30 * 86400_000)).take(300);
      const mine = new Set((await ctx.db.query("meetingParticipants").withIndex("by_user", (s) => s.eq("userId", user._id)).collect()).map((p) => p.meetingId));
      const r = upcoming
        .filter((m) => m.title.toLowerCase().includes(term) && (mine.has(m._id) || m.createdBy === user._id || (m.scope === "company" && can(user, "meetings.manage"))))
        .slice(0, 5);
      push("Meetings", r.map((m) => ({ id: m._id, title: m.title, subtitle: new Date(m.startsAt).toLocaleString("en-ZA", { timeZone: m.timezone }), href: `/calendar?meeting=${m._id}` })));
    }
    return groups;
  },
});
