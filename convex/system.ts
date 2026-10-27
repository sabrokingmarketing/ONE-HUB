import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { audit } from "./lib/audit";
import { emailMode } from "./lib/email";

const SETTING_KEYS = ["social.requireApproval", "social.publishingEnabled", "leads.retentionDays", "company.timezone"] as const;

export const auditLogs = query({
  args: { paginationOpts: paginationOptsValidator, entity: v.optional(v.string()) },
  handler: async (ctx, a) => {
    await requirePermission(ctx, "audit.read");
    const page = await ctx.db.query("auditLogs").withIndex("by_at").order("desc")
      .filter((q) => (a.entity ? q.eq(q.field("entity"), a.entity) : true))
      .paginate(a.paginationOpts);
    const names = new Map<string, string>();
    const rows = await Promise.all(page.page.map(async (r) => {
      if (r.actorId && !names.has(r.actorId)) names.set(r.actorId, (await ctx.db.get(r.actorId))?.name ?? "Unknown");
      return { ...r, actorName: r.actorId ? names.get(r.actorId)! : "System" };
    }));
    return { ...page, page: rows };
  },
});

export const settings = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "settings.manage");
    const rows = await ctx.db.query("integrationSettings").collect();
    const map: Record<string, string> = { "social.requireApproval": "false", "social.publishingEnabled": "false", "leads.retentionDays": "730", "company.timezone": "Africa/Johannesburg" };
    for (const r of rows) map[r.key] = r.value;
    return map;
  },
});

export const setSetting = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "settings.manage");
    if (!(SETTING_KEYS as readonly string[]).includes(a.key)) throw new ConvexError("Unknown setting.");
    const row = await ctx.db.query("integrationSettings").withIndex("by_key", (q) => q.eq("key", a.key)).unique();
    if (row) await ctx.db.patch(row._id, { value: a.value, updatedBy: user._id, updatedAt: Date.now() });
    else await ctx.db.insert("integrationSettings", { key: a.key, value: a.value, updatedBy: user._id, updatedAt: Date.now() });
    await audit(ctx, user._id, "setting", "integrationSettings", a.key, `Set ${a.key} = ${a.value}`);
  },
});

/**
 * Integration health. Each entry reports what we can actually verify from
 * inside Convex — "configured" means credentials exist, NOT that the
 * integration has been tested end-to-end.
 */
export const health = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "settings.manage");
    const [emails, calendars, accounts, failedPubs, storage] = await Promise.all([
      ctx.db.query("emailJobs").order("desc").take(200),
      ctx.db.query("calendarConnections").collect(),
      ctx.db.query("marketingAccounts").collect(),
      ctx.db.query("publishingJobs").withIndex("by_status_next", (q) => q.eq("status", "failed")).take(100),
      ctx.db.system.query("_storage").collect(),
    ]);
    const lastSent = emails.find((e) => e.status === "sent");
    const env = (k: string) => !!process.env[k];
    return {
      convex: { status: "operational" as const, detail: "You are reading this from the live database." },
      resend: {
        status: !env("RESEND_API_KEY") ? ("not_configured" as const) : lastSent ? ("verified" as const) : ("configured_unverified" as const),
        mode: emailMode(),
        detail: lastSent ? `Last successful send ${new Date(lastSent.sentAt!).toISOString()}` : "No email delivered yet.",
        failed: emails.filter((e) => e.status === "failed").length,
        queued: emails.filter((e) => e.status === "queued").length,
      },
      google: { status: env("AUTH_GOOGLE_CALENDAR_ID") ? ("configured_unverified" as const) : ("not_configured" as const), connections: calendars.filter((c) => c.provider === "google").length },
      microsoft: { status: env("AUTH_MICROSOFT_CALENDAR_ID") ? ("configured_unverified" as const) : ("not_configured" as const), connections: calendars.filter((c) => c.provider === "microsoft").length },
      social: accounts.map((a) => ({ name: a.name, platform: a.platform, status: a.status, lastError: a.lastError })),
      cloudflare: { status: "external" as const, detail: "Frontend hosting is monitored in the Cloudflare dashboard." },
      storage: { files: storage.length, bytes: storage.reduce((s, f) => s + f.size, 0) },
      failedPublishingJobs: failedPubs.length,
    };
  },
});
