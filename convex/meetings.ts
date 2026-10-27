import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requirePermission, requireUser, conflictError, notFound, type ActiveUser } from "./lib/auth";
import { can } from "./lib/permissionMatrix";
import { audit } from "./lib/audit";
import { enqueueEmail, notify, siteUrl } from "./lib/queue";
import { renderEmail } from "./lib/email";
import { clean } from "./lib/text";

const input = v.object({
  title: v.string(),
  description: v.optional(v.string()),
  startsAt: v.number(),
  endsAt: v.number(),
  timezone: v.optional(v.string()),
  location: v.optional(v.string()),
  videoLink: v.optional(v.string()),
  scope: v.union(v.literal("company"), v.literal("private")),
  reminderMinutes: v.array(v.number()),
  participantIds: v.array(v.id("users")),
  propertyId: v.optional(v.id("properties")),
  emailInvites: v.optional(v.boolean()),
});

function validate(i: typeof input.type) {
  const title = i.title.trim();
  if (!title) throw new ConvexError("Title is required.");
  if (i.endsAt <= i.startsAt) throw new ConvexError("The meeting must end after it starts.");
  if (i.endsAt - i.startsAt > 24 * 3600_000) throw new ConvexError("Meetings longer than 24 hours aren't supported.");
  if (i.videoLink && !/^https:\/\//.test(i.videoLink)) throw new ConvexError("Video link must start with https://");
  const reminders = [...new Set(i.reminderMinutes.filter((m) => m > 0 && m <= 7 * 24 * 60))].sort((a, b) => b - a).slice(0, 5);
  return {
    title,
    description: clean(i.description),
    startsAt: i.startsAt,
    endsAt: i.endsAt,
    timezone: i.timezone ?? "Africa/Johannesburg",
    location: clean(i.location),
    videoLink: clean(i.videoLink),
    scope: i.scope,
    reminderMinutes: reminders,
    propertyId: i.propertyId,
  };
}

async function canView(ctx: QueryCtx, user: ActiveUser, m: Doc<"meetings">) {
  if (m.createdBy === user._id || user.role === "super_admin") return true;
  if (m.scope === "company" && can(user, "meetings.manage")) return true;
  const p = await ctx.db.query("meetingParticipants").withIndex("by_meeting_user", (q) => q.eq("meetingId", m._id).eq("userId", user._id)).unique();
  return !!p;
}

async function syncReminders(ctx: MutationCtx, m: { _id: Id<"meetings">; startsAt: number; reminderMinutes: number[] }) {
  const existing = await ctx.db.query("meetingReminders").withIndex("by_meeting", (q) => q.eq("meetingId", m._id)).collect();
  for (const r of existing) if (!r.sentAt) await ctx.db.delete(r._id);
  const now = Date.now();
  for (const mins of m.reminderMinutes) {
    const sendAt = m.startsAt - mins * 60_000;
    if (sendAt > now) await ctx.db.insert("meetingReminders", { meetingId: m._id, sendAt, minutesBefore: mins });
  }
}

async function setParticipants(ctx: MutationCtx, meetingId: Id<"meetings">, ids: Id<"users">[]) {
  const current = await ctx.db.query("meetingParticipants").withIndex("by_meeting", (q) => q.eq("meetingId", meetingId)).collect();
  const want = new Set(ids);
  for (const p of current) if (!want.has(p.userId)) await ctx.db.delete(p._id);
  const have = new Set(current.map((p) => p.userId));
  const added: Id<"users">[] = [];
  for (const id of want) {
    if (have.has(id)) continue;
    const u = await ctx.db.get(id);
    if (!u?.role || u.status === "suspended") continue;
    await ctx.db.insert("meetingParticipants", { meetingId, userId: id, response: "pending" });
    added.push(id);
  }
  return added;
}

const fmt = (ms: number, tz: string) =>
  new Intl.DateTimeFormat("en-ZA", { dateStyle: "full", timeStyle: "short", timeZone: tz }).format(new Date(ms));

export const range = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "meetings.manage", "meetings.view_invited");
    if (a.to - a.from > 62 * 24 * 3600_000) throw new ConvexError("Range too large.");
    const rows = await ctx.db.query("meetings").withIndex("by_startsAt", (q) => q.gte("startsAt", a.from - 24 * 3600_000).lt("startsAt", a.to)).collect();
    const out = [];
    for (const m of rows) {
      if (m.endsAt < a.from) continue;
      if (!(await canView(ctx, user, m))) continue;
      const participants = await ctx.db.query("meetingParticipants").withIndex("by_meeting", (q) => q.eq("meetingId", m._id)).collect();
      out.push({ ...m, participantCount: participants.length, isMine: m.createdBy === user._id });
    }
    return out;
  },
});

export const upcoming = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "meetings.manage", "meetings.view_invited");
    const rows = await ctx.db.query("meetings").withIndex("by_startsAt", (q) => q.gte("startsAt", Date.now() - 3600_000)).take(100);
    const out = [];
    for (const m of rows) {
      if (m.status === "cancelled") continue;
      if (await canView(ctx, user, m)) out.push(m);
      if (out.length >= (a.limit ?? 5)) break;
    }
    return out;
  },
});

export const get = query({
  args: { id: v.id("meetings") },
  handler: async (ctx, { id }) => {
    const user = await requirePermission(ctx, "meetings.manage", "meetings.view_invited");
    const m = await ctx.db.get(id);
    if (!m || !(await canView(ctx, user, m))) return null;
    const parts = await ctx.db.query("meetingParticipants").withIndex("by_meeting", (q) => q.eq("meetingId", id)).collect();
    const participants = await Promise.all(parts.map(async (p) => ({ ...p, name: (await ctx.db.get(p.userId))?.name ?? "Unknown" })));
    const creator = await ctx.db.get(m.createdBy);
    return { ...m, participants, createdByName: creator?.name ?? "Unknown", canEdit: m.createdBy === user._id || user.role === "super_admin" || (m.scope === "company" && can(user, "meetings.manage")) };
  },
});

async function inviteParticipants(ctx: MutationCtx, organiser: ActiveUser, m: { _id: Id<"meetings">; title: string; startsAt: number; timezone: string; location?: string; videoLink?: string; description?: string }, ids: Id<"users">[], sendEmail: boolean) {
  const others = ids.filter((id) => id !== organiser._id);
  await notify(ctx, others, { type: "meeting", title: `Meeting invite: ${m.title}`, body: fmt(m.startsAt, m.timezone), link: `/calendar?meeting=${m._id}` });
  if (!sendEmail) return;
  for (const uid of others) {
    const u = await ctx.db.get(uid);
    if (!u?.email) continue;
    await enqueueEmail(ctx, {
      kind: "meeting_invite",
      to: u.email,
      subject: `Invitation: ${m.title}`,
      dedupeKey: `meeting-invite:${m._id}:${uid}:${m.startsAt}`,
      html: renderEmail({
        badge: "Meeting invitation",
        heading: m.title,
        intro: `${organiser.name ?? "A colleague"} invited you to a meeting.`,
        bodyText: [`When: ${fmt(m.startsAt, m.timezone)}`, m.location ? `Where: ${m.location}` : "", m.videoLink ? `Video: ${m.videoLink}` : "", m.description ?? ""].filter(Boolean).join("\n\n"),
        ctaLabel: "View in ONE HUB",
        ctaUrl: siteUrl(`/calendar?meeting=${m._id}`),
      }),
    });
  }
}

export const create = mutation({
  args: { data: input },
  handler: async (ctx, { data }) => {
    const user = await requireUser(ctx);
    const d = validate(data);
    if (d.scope === "company" && !can(user, "meetings.manage")) throw new ConvexError({ code: "FORBIDDEN", message: "Only directors can create company meetings." });
    if (d.scope === "private" && !can(user, "calendar.personal") && !can(user, "meetings.manage")) throw new ConvexError({ code: "FORBIDDEN", message: "Calendar is not enabled for your account." });
    const id = await ctx.db.insert("meetings", { ...d, status: "scheduled", createdBy: user._id, updatedBy: user._id, updatedAt: Date.now(), version: 1 });
    const added = await setParticipants(ctx, id, [user._id, ...data.participantIds]);
    await syncReminders(ctx, { _id: id, ...d });
    await inviteParticipants(ctx, user, { _id: id, ...d }, added, !!data.emailInvites);
    await audit(ctx, user._id, "create", "meetings", id, `Scheduled "${d.title}"`);
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("meetings"), expectedVersion: v.number(), data: input },
  handler: async (ctx, { id, expectedVersion, data }) => {
    const user = await requireUser(ctx);
    const m = await ctx.db.get(id);
    if (!m) throw notFound("Meeting");
    const allowed = m.createdBy === user._id || user.role === "super_admin" || (m.scope === "company" && can(user, "meetings.manage"));
    if (!allowed) throw new ConvexError({ code: "FORBIDDEN", message: "You can't edit this meeting." });
    if (m.version !== expectedVersion) throw conflictError("meeting");
    const d = validate(data);
    await ctx.db.patch(id, { ...d, updatedBy: user._id, updatedAt: Date.now(), version: m.version + 1 });
    const added = await setParticipants(ctx, id, [m.createdBy, ...data.participantIds]);
    await syncReminders(ctx, { _id: id, ...d });
    await inviteParticipants(ctx, user, { _id: id, ...d }, added, !!data.emailInvites);
    await audit(ctx, user._id, "update", "meetings", id, `Updated "${d.title}"`);
  },
});

export const cancel = mutation({
  args: { id: v.id("meetings") },
  handler: async (ctx, { id }) => {
    const user = await requireUser(ctx);
    const m = await ctx.db.get(id);
    if (!m) throw notFound("Meeting");
    const allowed = m.createdBy === user._id || user.role === "super_admin" || (m.scope === "company" && can(user, "meetings.manage"));
    if (!allowed) throw new ConvexError({ code: "FORBIDDEN", message: "You can't cancel this meeting." });
    await ctx.db.patch(id, { status: "cancelled", updatedBy: user._id, updatedAt: Date.now(), version: m.version + 1 });
    const reminders = await ctx.db.query("meetingReminders").withIndex("by_meeting", (q) => q.eq("meetingId", id)).collect();
    for (const r of reminders) if (!r.sentAt) await ctx.db.delete(r._id);
    const parts = await ctx.db.query("meetingParticipants").withIndex("by_meeting", (q) => q.eq("meetingId", id)).collect();
    await notify(ctx, parts.map((p) => p.userId).filter((u) => u !== user._id), { type: "meeting", title: `Cancelled: ${m.title}`, body: fmt(m.startsAt, m.timezone) });
    await audit(ctx, user._id, "cancel", "meetings", id, `Cancelled "${m.title}"`);
  },
});

export const respond = mutation({
  args: { id: v.id("meetings"), response: v.union(v.literal("accepted"), v.literal("declined")) },
  handler: async (ctx, a) => {
    const user = await requireUser(ctx);
    const p = await ctx.db.query("meetingParticipants").withIndex("by_meeting_user", (q) => q.eq("meetingId", a.id).eq("userId", user._id)).unique();
    if (!p) throw notFound("Invitation");
    await ctx.db.patch(p._id, { response: a.response });
  },
});

/** Cron: deliver due meeting reminders (in-app + optional email fallback). */
export const sendDueReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const due = await ctx.db.query("meetingReminders").withIndex("by_sendAt", (q) => q.eq("sentAt", undefined).lte("sendAt", Date.now())).take(50);
    for (const r of due) {
      await ctx.db.patch(r._id, { sentAt: Date.now() });
      const m = await ctx.db.get(r.meetingId);
      if (!m || m.status === "cancelled" || m.startsAt < Date.now()) continue;
      const parts = await ctx.db.query("meetingParticipants").withIndex("by_meeting", (q) => q.eq("meetingId", m._id)).collect();
      const label = r.minutesBefore >= 1440 ? `in ${Math.round(r.minutesBefore / 1440)} day(s)` : r.minutesBefore >= 60 ? `in ${Math.round(r.minutesBefore / 60)} hour(s)` : `in ${r.minutesBefore} minutes`;
      const userIds = parts.filter((p) => p.response !== "declined").map((p) => p.userId);
      await notify(ctx, userIds, { type: "meeting", title: `${m.title} starts ${label}`, body: fmt(m.startsAt, m.timezone), link: `/calendar?meeting=${m._id}` });
      for (const uid of userIds) {
        const prefs = await ctx.db.query("notificationPreferences").withIndex("by_user", (q) => q.eq("userId", uid)).unique();
        if (!prefs?.emailFallback) continue;
        const u = await ctx.db.get(uid);
        if (!u?.email) continue;
        await enqueueEmail(ctx, {
          kind: "meeting_reminder", to: u.email, subject: `Reminder: ${m.title} ${label}`, dedupeKey: `reminder:${r._id}:${uid}`,
          html: renderEmail({ badge: "Reminder", heading: m.title, intro: `Starts ${label}.`, bodyText: [`When: ${fmt(m.startsAt, m.timezone)}`, m.location ? `Where: ${m.location}` : "", m.videoLink ? `Video: ${m.videoLink}` : ""].filter(Boolean).join("\n\n"), ctaLabel: "Open meeting", ctaUrl: siteUrl(`/calendar?meeting=${m._id}`) }),
        });
      }
    }
  },
});

export const myConnections = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db.query("calendarConnections").withIndex("by_user", (q) => q.eq("userId", user._id)).collect();
    // Never return tokens to the client.
    return rows.map((c) => ({ _id: c._id, provider: c.provider, accountEmail: c.accountEmail, status: c.status, lastSyncAt: c.lastSyncAt, lastError: c.lastError }));
  },
});
