import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { deliverEmail, emailMode, type DeliveryError } from "./lib/email";
import { nextUtcMidnight, quotaSnapshot, recordSent, utcDay } from "./lib/quota";
import { requirePermission } from "./lib/auth";

// Resend's API allows several requests/second per account; we stay well under it.
const BATCH = 8;
const SPACING_MS = 600;
const MAX_ATTEMPTS = 4;
const DEFER_PER_RUN = 200;

const finite = (n: number) => (Number.isFinite(n) ? n : null);

export const claimBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const quota = await quotaSnapshot(ctx, now);
    const take = Math.min(BATCH, quota.remaining);
    if (take <= 0) {
      // Cap reached: park due jobs until the next UTC day instead of failing them.
      const due = await ctx.db
        .query("emailJobs")
        .withIndex("by_status_next", (q) => q.eq("status", "queued").lte("nextAttemptAt", now))
        .take(DEFER_PER_RUN);
      const reason = quota.limits.daily && quota.sentToday + quota.inFlight >= quota.limits.daily ? "daily sending limit reached" : "monthly sending limit reached";
      for (const j of due) await ctx.db.patch(j._id, { nextAttemptAt: quota.resetsAt + 60_000, deferredReason: reason });
      return [];
    }
    const jobs = await ctx.db
      .query("emailJobs")
      .withIndex("by_status_next", (q) => q.eq("status", "queued").lte("nextAttemptAt", now))
      .take(take);
    // nextAttemptAt doubles as the claim time while a job is "sending" (see recoverStuck).
    for (const j of jobs) await ctx.db.patch(j._id, { status: "sending", attempts: j.attempts + 1, nextAttemptAt: now, deferredReason: undefined });
    const shared = new Map<string, string>();
    const out = [];
    for (const j of jobs) {
      let html = j.html;
      if (html === undefined && j.announcementId) {
        if (!shared.has(j.announcementId)) shared.set(j.announcementId, (await ctx.db.get(j.announcementId))?.html ?? "");
        html = shared.get(j.announcementId);
      }
      out.push({ _id: j._id, to: j.to, subject: j.subject, html: html ?? "", attempts: j.attempts + 1 });
    }
    return out;
  },
});

async function settleAnnouncement(ctx: MutationCtx, job: Doc<"emailJobs">) {
  if (!job.announcementId) return;
  const ann = await ctx.db.get(job.announcementId);
  if (!ann) return;
  // Point lookups on [announcementId, status] keep this cheap for large audiences.
  const has = async (status: Doc<"emailJobs">["status"]) =>
    !!(await ctx.db
      .query("emailJobs")
      .withIndex("by_announcement", (q) => q.eq("announcementId", ann._id).eq("status", status))
      .first());
  if ((await has("queued")) || (await has("sending"))) {
    if (ann.status === "queued") await ctx.db.patch(ann._id, { status: "sending" });
    return;
  }
  const bad = (await has("failed")) || (await has("bounced")) || (await has("complained"));
  const status = bad ? "partial" : "sent";
  if (ann.status !== status) await ctx.db.patch(ann._id, { status });
}

export const markResult = internalMutation({
  args: {
    id: v.id("emailJobs"),
    ok: v.boolean(),
    logged: v.optional(v.boolean()),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
    deferUntil: v.optional(v.number()),
  },
  handler: async (ctx, a) => {
    const job = await ctx.db.get(a.id);
    if (!job) return;
    if (a.ok) {
      await ctx.db.patch(a.id, { status: a.logged ? "logged" : "sent", providerId: a.providerId, sentAt: Date.now(), error: undefined });
      if (!a.logged) await recordSent(ctx);
    } else if (a.deferUntil) {
      // Provider cap hit: wait for the reset without spending a retry attempt.
      await ctx.db.patch(a.id, { status: "queued", attempts: Math.max(0, job.attempts - 1), nextAttemptAt: a.deferUntil, deferredReason: a.error });
    } else if (a.retryable && job.attempts < MAX_ATTEMPTS) {
      await ctx.db.patch(a.id, { status: "queued", error: a.error, nextAttemptAt: Date.now() + 2 ** job.attempts * 30_000 });
    } else {
      await ctx.db.patch(a.id, { status: "failed", error: a.error });
    }
    const updated = await ctx.db.get(a.id);
    if (updated) await settleAnnouncement(ctx, updated);
  },
});

export const processQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.runMutation(internal.emails.claimBatch, {});
    for (const job of jobs) {
      if (!job.html) {
        await ctx.runMutation(internal.emails.markResult, { id: job._id, ok: false, error: "Email content is missing.", retryable: false });
        continue;
      }
      try {
        // Same key for same-day retries (no double send after a timeout); a job deferred to the
        // next day by the sending limit gets a fresh key so a cached quota error can't replay.
        const r = await deliverEmail(job.to, job.subject, job.html, `onehub-${job._id}-${utcDay(Date.now())}`);
        await ctx.runMutation(internal.emails.markResult, { id: job._id, ok: true, logged: r.status === "logged", providerId: r.providerId });
      } catch (e) {
        const err = e as DeliveryError;
        await ctx.runMutation(internal.emails.markResult, {
          id: job._id,
          ok: false,
          error: err.message,
          retryable: err.retryable ?? true,
          deferUntil: err.quota ? Math.max(nextUtcMidnight(Date.now()) + 60_000, Date.now() + 60 * 60_000) : undefined,
        });
      }
      await new Promise((r) => setTimeout(r, SPACING_MS));
    }
    if (jobs.length === BATCH) await ctx.scheduler.runAfter(0, internal.emails.processQueue, {});
  },
});

/** Requeue jobs stuck in "sending" (e.g. action crashed) and pick up deferred jobs — run by cron. */
export const recoverStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 10 * 60_000;
    const stuck = await ctx.db
      .query("emailJobs")
      .withIndex("by_status_next", (q) => q.eq("status", "sending").lte("nextAttemptAt", cutoff))
      .take(50);
    for (const j of stuck) await ctx.db.patch(j._id, { status: "queued", nextAttemptAt: Date.now() });
    const due = await ctx.db
      .query("emailJobs")
      .withIndex("by_status_next", (q) => q.eq("status", "queued").lte("nextAttemptAt", Date.now()))
      .first();
    if (due) await ctx.scheduler.runAfter(0, internal.emails.processQueue, {});
  },
});

// Later events never move a job "backwards" (webhooks may arrive out of order).
const RANK: Record<Doc<"emailJobs">["status"], number> = {
  queued: 0, sending: 0, logged: 0, sent: 1, delivery_delayed: 2, delivered: 3, failed: 4, bounced: 4, complained: 5,
};
const EVENT_STATUS: Record<string, Doc<"emailJobs">["status"] | undefined> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.delivery_delayed": "delivery_delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.failed": "failed",
  "email.suppressed": "failed",
};

/** Applies a verified Resend webhook event to the matching email job. */
export const applyWebhookEvent = internalMutation({
  args: { type: v.string(), emailId: v.string(), at: v.number(), detail: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const status = EVENT_STATUS[a.type];
    if (!status) return { applied: false, reason: "ignored event type" };
    const job = await ctx.db
      .query("emailJobs")
      .withIndex("by_providerId", (q) => q.eq("providerId", a.emailId))
      .first();
    if (!job) return { applied: false, reason: "unknown email" };
    if (RANK[status] < RANK[job.status] || (RANK[status] === RANK[job.status] && status === job.status)) {
      return { applied: false, reason: "stale event" };
    }
    await ctx.db.patch(job._id, {
      status,
      lastEventAt: a.at,
      ...(status === "delivered" ? { deliveredAt: a.at } : {}),
      ...(a.detail && RANK[status] >= 4 ? { error: a.detail } : {}),
    });
    await settleAnnouncement(ctx, { ...job, status });
    return { applied: true };
  },
});

export const history = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "settings.manage");
    const jobs = await ctx.db.query("emailJobs").order("desc").take(100);
    return {
      mode: emailMode(),
      jobs: jobs.map(({ html: _html, ...j }) => j),
    };
  },
});

/** Sending usage measured by ONE HUB against the configured plan caps. */
export const usage = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "settings.manage");
    const q = await quotaSnapshot(ctx);
    const waiting = await ctx.db
      .query("emailJobs")
      .withIndex("by_status_next", (x) => x.eq("status", "queued"))
      .take(1000);
    return {
      mode: q.mode,
      limits: q.limits,
      sentToday: q.sentToday,
      sentMonth: q.sentMonth,
      remaining: finite(q.remaining),
      resetsAt: q.resetsAt,
      queued: waiting.length,
      deferred: waiting.filter((j) => j.deferredReason).length,
      webhookConfigured: !!process.env.RESEND_WEBHOOK_SECRET,
    };
  },
});

export const assertCanManage = internalQuery({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "settings.manage");
  },
});

/**
 * Checks the Resend API key without sending anything. A "Sending access" key
 * cannot list domains, so a `restricted_api_key` answer still proves the key is valid.
 */
export const checkConnection = action({
  args: {},
  handler: async (ctx): Promise<{
    keyConfigured: boolean;
    keyValid: boolean | null;
    restricted: boolean;
    fromAddress: string | null;
    fromDomain: string | null;
    domains: { name: string; status: string }[] | null;
    fromDomainStatus: string | null;
    webhookConfigured: boolean;
    mode: string;
    message: string;
  }> => {
    await ctx.runQuery(internal.emails.assertCanManage, {});
    const key = process.env.RESEND_API_KEY;
    const from = process.env.ONEHUB_EMAIL_FROM ?? null;
    const fromDomain = from?.match(/@([^>\s]+)/)?.[1]?.toLowerCase() ?? null;
    const base = { fromAddress: from, fromDomain, webhookConfigured: !!process.env.RESEND_WEBHOOK_SECRET, mode: emailMode() };
    if (!key) {
      return { ...base, keyConfigured: false, keyValid: null, restricted: false, domains: null, fromDomainStatus: null, message: "RESEND_API_KEY is not set on this deployment." };
    }
    const res = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
    const data = (await res.json().catch(() => ({}))) as { name?: string; message?: string; data?: { name: string; status: string }[] };
    if (res.ok) {
      const domains = (data.data ?? []).map((d) => ({ name: d.name, status: d.status }));
      const match = domains.find((d) => d.name.toLowerCase() === fromDomain);
      return {
        ...base, keyConfigured: true, keyValid: true, restricted: false, domains, fromDomainStatus: match?.status ?? null,
        message: match ? `Key valid. Sending domain ${match.name} is ${match.status}.` : `Key valid, but ${fromDomain ?? "the From domain"} is not in this Resend account.`,
      };
    }
    if (data.name === "restricted_api_key") {
      return { ...base, keyConfigured: true, keyValid: true, restricted: true, domains: null, fromDomainStatus: null, message: "Key valid (sending-only). Domain status is visible in the Resend dashboard." };
    }
    return { ...base, keyConfigured: true, keyValid: false, restricted: false, domains: null, fromDomainStatus: null, message: `Resend rejected the key (${res.status}${data.name ? ` ${data.name}` : ""}).` };
  },
});
