import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePermission } from "./lib/auth";
import { audit } from "./lib/audit";
import { enqueueEmail, notify, usersWithRoles } from "./lib/queue";
import { renderEmail, emailMode } from "./lib/email";

const template = v.union(
  v.literal("general"),
  v.literal("important"),
  v.literal("meeting"),
  v.literal("event"),
  v.literal("document"),
  v.literal("reminder"),
);
const TEMPLATE_BADGE: Record<string, string> = {
  general: "Company update",
  important: "Important",
  meeting: "Meeting",
  event: "Event invitation",
  document: "New document",
  reminder: "Reminder",
};
const audienceArgs = {
  audience: v.union(v.literal("all"), v.literal("department"), v.literal("selected")),
  department: v.optional(v.string()),
  employeeIds: v.optional(v.array(v.id("employees"))),
};

async function hashKey(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildHtml(a: { subject: string; body: string; template: string; linkUrl?: string; linkLabel?: string }) {
  return renderEmail({
    badge: TEMPLATE_BADGE[a.template],
    heading: a.subject,
    bodyText: a.body,
    ctaLabel: a.linkUrl ? a.linkLabel || "Open link" : undefined,
    ctaUrl: a.linkUrl,
  });
}

/** Resolves the recipient list (email addresses) for an announcement. */
export const recipients = query({
  args: audienceArgs,
  handler: async (ctx, a) => {
    await requirePermission(ctx, "announcements.send");
    const all = await ctx.db.query("employees").withIndex("by_archived", (q) => q.eq("archivedAt", undefined)).collect();
    let picked = all.filter((e) => e.employmentStatus !== "terminated");
    if (a.audience === "department") picked = picked.filter((e) => e.department === a.department);
    if (a.audience === "selected") {
      const ids = new Set(a.employeeIds ?? []);
      picked = picked.filter((e) => ids.has(e._id));
    }
    const withEmail = picked.filter((e) => e.email);
    return {
      recipients: withEmail.map((e) => ({ _id: e._id, name: `${e.firstName} ${e.lastName}`, email: e.email!, department: e.department })),
      missingEmail: picked.length - withEmail.length,
      mode: emailMode(),
    };
  },
});

export const preview = query({
  args: { subject: v.string(), body: v.string(), template, linkUrl: v.optional(v.string()), linkLabel: v.optional(v.string()) },
  handler: async (ctx, a) => {
    await requirePermission(ctx, "announcements.send");
    return buildHtml(a);
  },
});

export const sendTest = mutation({
  args: { subject: v.string(), body: v.string(), template, linkUrl: v.optional(v.string()), linkLabel: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "announcements.send");
    if (!user.email) throw new ConvexError("Your account has no email address.");
    await enqueueEmail(ctx, {
      kind: "announcement_test",
      to: user.email,
      subject: `[Test] ${a.subject}`,
      html: buildHtml(a),
      dedupeKey: `test:${user._id}:${Date.now()}`,
    });
    return user.email;
  },
});

export const send = mutation({
  args: {
    ...audienceArgs,
    subject: v.string(),
    body: v.string(),
    template,
    linkUrl: v.optional(v.string()),
    linkLabel: v.optional(v.string()),
    confirmedCount: v.number(),
  },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "announcements.send");
    const subject = a.subject.trim();
    const body = a.body.trim();
    if (!subject || !body) throw new ConvexError("Subject and message are required.");
    if (a.linkUrl && !/^https:\/\//.test(a.linkUrl)) throw new ConvexError("Links must start with https://");

    const all = await ctx.db.query("employees").withIndex("by_archived", (q) => q.eq("archivedAt", undefined)).collect();
    let picked = all.filter((e) => e.employmentStatus !== "terminated" && e.email);
    if (a.audience === "department") picked = picked.filter((e) => e.department === a.department);
    if (a.audience === "selected") {
      const ids = new Set(a.employeeIds ?? []);
      picked = picked.filter((e) => ids.has(e._id));
    }
    if (picked.length === 0) throw new ConvexError("No recipients with an email address.");
    if (picked.length !== a.confirmedCount) {
      throw new ConvexError({ code: "CONFLICT", message: "The recipient list changed since you confirmed it. Please review and confirm again." });
    }
    const emails = picked.map((e) => e.email!).sort();
    const dedupeKey = await hashKey(`${subject}\n${body}\n${emails.join(",")}`);
    const recent = await ctx.db.query("announcements").withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", dedupeKey)).first();
    if (recent && Date.now() - recent.sentAt < 24 * 60 * 60 * 1000) {
      throw new ConvexError({ code: "DUPLICATE", message: "This exact announcement was already sent to these recipients in the last 24 hours." });
    }
    const html = buildHtml({ ...a, subject, body });
    const id = await ctx.db.insert("announcements", {
      subject, body, template: a.template, audience: a.audience, department: a.department,
      recipientCount: emails.length, dedupeKey, status: "queued", sentBy: user._id, sentAt: Date.now(),
    });
    for (const to of emails) {
      await enqueueEmail(ctx, { kind: "announcement", to, subject, html, dedupeKey: `ann:${id}:${to}`, announcementId: id }, { kick: false });
    }
    await ctx.scheduler.runAfter(0, internal.emails.processQueue, {});
    await audit(ctx, user._id, "announcement.send", "announcements", id, `Sent "${subject}" to ${emails.length} employees`);
    const others = (await usersWithRoles(ctx, ["director", "super_admin"])).filter((uid) => uid !== user._id);
    await notify(ctx, others, { type: "announcement", title: `${user.name ?? "A director"} sent: ${subject}`, link: "/directors/employees/announcements" });
    return { id, count: emails.length };
  },
});

export const history = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "announcements.send");
    const rows = await ctx.db.query("announcements").withIndex("by_sentAt").order("desc").take(50);
    return await Promise.all(
      rows.map(async (r) => {
        const sender = await ctx.db.get(r.sentBy);
        const jobs = await ctx.db.query("emailJobs").withIndex("by_announcement", (q) => q.eq("announcementId", r._id)).collect();
        const tally = { queued: 0, sending: 0, sent: 0, logged: 0, failed: 0 };
        for (const j of jobs) tally[j.status]++;
        return { ...r, senderName: sender?.name ?? "Unknown", tally };
      }),
    );
  },
});
