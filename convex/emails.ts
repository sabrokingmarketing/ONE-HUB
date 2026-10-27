import { v } from "convex/values";
import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { deliverEmail, emailMode } from "./lib/email";
import { requirePermission } from "./lib/auth";

// Resend free tier allows a small requests/second budget; we stay well under it.
const BATCH = 8;
const SPACING_MS = 600;
const MAX_ATTEMPTS = 4;

export const claimBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const jobs = await ctx.db
      .query("emailJobs")
      .withIndex("by_status_next", (q) => q.eq("status", "queued").lte("nextAttemptAt", now))
      .take(BATCH);
    for (const j of jobs) await ctx.db.patch(j._id, { status: "sending", attempts: j.attempts + 1 });
    return jobs.map((j) => ({ _id: j._id, to: j.to, subject: j.subject, html: j.html, attempts: j.attempts + 1 }));
  },
});

export const markResult = internalMutation({
  args: {
    id: v.id("emailJobs"),
    ok: v.boolean(),
    logged: v.optional(v.boolean()),
    providerId: v.optional(v.string()),
    error: v.optional(v.string()),
    retryable: v.optional(v.boolean()),
  },
  handler: async (ctx, a) => {
    const job = await ctx.db.get(a.id);
    if (!job) return;
    if (a.ok) {
      await ctx.db.patch(a.id, { status: a.logged ? "logged" : "sent", providerId: a.providerId, sentAt: Date.now(), error: undefined });
    } else if (a.retryable && job.attempts < MAX_ATTEMPTS) {
      await ctx.db.patch(a.id, { status: "queued", error: a.error, nextAttemptAt: Date.now() + 2 ** job.attempts * 30_000 });
    } else {
      await ctx.db.patch(a.id, { status: "failed", error: a.error });
    }
    if (job.announcementId) {
      const ann = await ctx.db.get(job.announcementId);
      if (ann && ann.status !== "sent" && ann.status !== "partial") {
        const pending = await ctx.db
          .query("emailJobs")
          .withIndex("by_announcement", (q) => q.eq("announcementId", job.announcementId))
          .filter((q) => q.or(q.eq(q.field("status"), "queued"), q.eq(q.field("status"), "sending")))
          .first();
        if (!pending) {
          const failed = await ctx.db
            .query("emailJobs")
            .withIndex("by_announcement", (q) => q.eq("announcementId", job.announcementId))
            .filter((q) => q.eq(q.field("status"), "failed"))
            .first();
          await ctx.db.patch(ann._id, { status: failed ? "partial" : "sent" });
        }
      }
    }
  },
});

export const processQueue = internalAction({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.runMutation(internal.emails.claimBatch, {});
    for (const job of jobs) {
      try {
        const r = await deliverEmail(job.to, job.subject, job.html);
        await ctx.runMutation(internal.emails.markResult, { id: job._id, ok: true, logged: r.status === "logged", providerId: r.providerId });
      } catch (e) {
        const err = e as Error & { retryable?: boolean };
        await ctx.runMutation(internal.emails.markResult, { id: job._id, ok: false, error: err.message, retryable: err.retryable ?? true });
      }
      await new Promise((r) => setTimeout(r, SPACING_MS));
    }
    if (jobs.length === BATCH) await ctx.scheduler.runAfter(0, internal.emails.processQueue, {});
  },
});

/** Requeue jobs stuck in "sending" (e.g. action crashed) — run by cron. */
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
