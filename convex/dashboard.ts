import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { can } from "./lib/permissionMatrix";

const DAY = 86400_000;

/**
 * Counts are computed with bounded scans. At ONE Property Holdings' scale
 * (hundreds–low thousands of records) this stays well within Convex free-tier
 * limits; if tables grow past ~10k rows, switch to maintained counters.
 */
export const admin = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "dashboard.admin");
    const now = Date.now();
    const [users, brokers, employees, leads, campaigns, posts, meetings, emails, failedJobs] = await Promise.all([
      ctx.db.query("users").collect(),
      ctx.db.query("brokers").withIndex("by_archived", (q) => q.eq("archivedAt", undefined)).collect(),
      ctx.db.query("employees").withIndex("by_archived", (q) => q.eq("archivedAt", undefined)).collect(),
      ctx.db.query("leads").withIndex("by_submittedAt", (q) => q.gte("submittedAt", now - 30 * DAY)).collect(),
      ctx.db.query("marketingCampaigns").withIndex("by_status", (q) => q.eq("status", "active")).collect(),
      ctx.db.query("socialPosts").collect(),
      ctx.db.query("meetings").withIndex("by_startsAt", (q) => q.gte("startsAt", now).lt("startsAt", now + 14 * DAY)).collect(),
      ctx.db.query("emailJobs").order("desc").take(500),
      ctx.db.query("emailJobs").withIndex("by_status_next", (q) => q.eq("status", "failed")).take(100),
    ]);
    const active = users.filter((u) => u.role && u.status !== "suspended");
    // Leads per day for the last 14 days (Africa/Johannesburg is UTC+2, no DST).
    const series: { day: string; leads: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * DAY + 2 * 3600_000).toISOString().slice(0, 10);
      series.push({ day: d, leads: 0 });
    }
    for (const l of leads) {
      const d = new Date(l.submittedAt + 2 * 3600_000).toISOString().slice(0, 10);
      const s = series.find((x) => x.day === d);
      if (s) s.leads++;
    }
    const activity = await ctx.db.query("auditLogs").withIndex("by_at").order("desc").take(12);
    const actorNames = new Map(users.map((u) => [u._id, u.name ?? u.email ?? "User"]));
    return {
      totals: {
        users: active.length,
        directors: active.filter((u) => u.role === "director").length,
        marketing: active.filter((u) => u.role === "marketing").length,
        brokers: brokers.length,
        employees: employees.length,
        newLeads: leads.filter((l) => l.status === "new" && !l.archivedAt).length,
        leads30d: leads.length,
        activeCampaigns: campaigns.length,
        scheduledPosts: posts.filter((p) => p.status === "scheduled").length,
        publishedPosts: posts.filter((p) => p.status === "published").length,
        failedPosts: posts.filter((p) => p.status === "failed").length,
        upcomingMeetings: meetings.filter((m) => m.status === "scheduled").length,
        emailsSent7d: emails.filter((e) => (e.status === "sent" || e.status === "logged") && (e.sentAt ?? 0) > now - 7 * DAY).length,
        emailFailures: failedJobs.length,
      },
      leadSeries: series,
      activity: activity.map((a) => ({ ...a, actorName: a.actorId ? actorNames.get(a.actorId) ?? "Unknown" : "System" })),
    };
  },
});

export const director = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "dashboard.director", "dashboard.admin");
    const now = Date.now();
    const [recentBrokers, recentEmployees, newLeads, myLeads, announcements] = await Promise.all([
      ctx.db.query("brokers").withIndex("by_archived", (q) => q.eq("archivedAt", undefined)).order("desc").take(5),
      ctx.db.query("employees").withIndex("by_archived", (q) => q.eq("archivedAt", undefined)).order("desc").take(5),
      ctx.db.query("leads").withIndex("by_status", (q) => q.eq("status", "new")).order("desc").take(50),
      ctx.db.query("leads").withIndex("by_assignee", (q) => q.eq("assignedTo", user._id)).collect(),
      ctx.db.query("announcements").withIndex("by_sentAt").order("desc").take(3),
    ]);
    const posts = can(user, "social.read") ? await ctx.db.query("socialPosts").withIndex("by_scheduledAt", (q) => q.gte("scheduledAt", now).lt("scheduledAt", now + 7 * 86400_000)).collect() : [];
    return {
      recentBrokers: recentBrokers.map((b) => ({ _id: b._id, fullName: b.fullName, company: b.company, _creationTime: b._creationTime })),
      recentEmployees: recentEmployees.map((e) => ({ _id: e._id, name: `${e.firstName} ${e.lastName}`, jobTitle: e.jobTitle, updatedAt: e.updatedAt })),
      newLeads: newLeads.filter((l) => !l.archivedAt).slice(0, 6).map((l) => ({ _id: l._id, name: l.name, source: l.source, submittedAt: l.submittedAt })),
      newLeadCount: newLeads.filter((l) => !l.archivedAt).length,
      followUps: myLeads.filter((l) => !l.archivedAt && (l.status === "follow_up" || l.status === "contacted")).length,
      announcements: announcements.map((a) => ({ _id: a._id, subject: a.subject, sentAt: a.sentAt, template: a.template })),
      marketing: { postsThisWeek: posts.filter((p) => p.status === "scheduled").length },
    };
  },
});

export const marketing = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "dashboard.marketing", "dashboard.admin");
    const now = Date.now();
    const [accounts, upcoming, failed, published, campaigns, leads] = await Promise.all([
      ctx.db.query("marketingAccounts").collect(),
      ctx.db.query("socialPosts").withIndex("by_status_scheduledAt", (q) => q.eq("status", "scheduled").gte("scheduledAt", now)).take(8),
      ctx.db.query("socialPosts").withIndex("by_status_scheduledAt", (q) => q.eq("status", "failed")).collect(),
      ctx.db.query("socialPosts").withIndex("by_status_scheduledAt", (q) => q.eq("status", "published")).collect(),
      ctx.db.query("marketingCampaigns").withIndex("by_status", (q) => q.eq("status", "active")).collect(),
      ctx.db.query("leads").withIndex("by_submittedAt", (q) => q.gte("submittedAt", now - 7 * DAY)).collect(),
    ]);
    return {
      accounts: accounts.map((a) => ({ _id: a._id, name: a.name, platform: a.platform, status: a.status })),
      upcoming: upcoming.map((p) => ({ _id: p._id, caption: p.caption, scheduledAt: p.scheduledAt })),
      counts: {
        scheduled: (await ctx.db.query("socialPosts").withIndex("by_status_scheduledAt", (q) => q.eq("status", "scheduled")).collect()).length,
        failed: failed.length,
        published: published.length,
        activeCampaigns: campaigns.length,
        newLeads7d: leads.filter((l) => l.visibleToMarketing && !l.archivedAt).length,
      },
      campaigns: campaigns.slice(0, 5).map((c) => ({ _id: c._id, name: c.name, endDate: c.endDate, progress: c.tasks.length ? Math.round((c.tasks.filter((t) => t.done).length / c.tasks.length) * 100) : null })),
    };
  },
});
