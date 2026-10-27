import { v, ConvexError } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { postStatus } from "./schema";
import { requirePermission, conflictError, notFound } from "./lib/auth";
import { can } from "./lib/permissionMatrix";
import { audit } from "./lib/audit";
import { enqueueEmail, notify, siteUrl, usersWithRoles } from "./lib/queue";
import { renderEmail } from "./lib/email";
import { publishToPlatform, PublishError, validateForPlatform } from "./lib/publishers";

const MAX_ATTEMPTS = 3;
const input = v.object({
  caption: v.string(),
  hashtags: v.array(v.string()),
  accountIds: v.array(v.id("marketingAccounts")),
  mediaStorageIds: v.array(v.id("_storage")),
  propertyId: v.optional(v.id("properties")),
  campaignId: v.optional(v.id("marketingCampaigns")),
  scheduledAt: v.optional(v.number()),
  timezone: v.optional(v.string()),
});

function normalise(i: typeof input.type) {
  const caption = i.caption.trim();
  const hashtags = [...new Set(i.hashtags.map((h) => h.trim().replace(/^#*/, "")).filter(Boolean))].slice(0, 30);
  if (caption.length > 2200) throw new ConvexError("Captions are limited to 2,200 characters (Instagram limit).");
  if (i.mediaStorageIds.length > 10) throw new ConvexError("A post can have at most 10 media files.");
  return { ...i, caption, hashtags, timezone: i.timezone ?? "Africa/Johannesburg" };
}

async function requireApproval(ctx: { db: import("./_generated/server").QueryCtx["db"] }) {
  const s = await ctx.db.query("integrationSettings").withIndex("by_key", (q) => q.eq("key", "social.requireApproval")).unique();
  return s?.value === "true";
}

export const list = query({
  args: { status: v.optional(postStatus), from: v.optional(v.number()), to: v.optional(v.number()) },
  handler: async (ctx, a) => {
    await requirePermission(ctx, "social.read");
    let rows: Doc<"socialPosts">[];
    if (a.from !== undefined && a.to !== undefined) {
      rows = await ctx.db.query("socialPosts").withIndex("by_scheduledAt", (q) => q.gte("scheduledAt", a.from!).lt("scheduledAt", a.to!)).collect();
    } else if (a.status) {
      rows = await ctx.db.query("socialPosts").withIndex("by_status_scheduledAt", (q) => q.eq("status", a.status!)).order("desc").take(200);
    } else {
      rows = await ctx.db.query("socialPosts").order("desc").take(200);
    }
    if (a.status) rows = rows.filter((r) => r.status === a.status);
    const accounts = new Map((await ctx.db.query("marketingAccounts").collect()).map((x) => [x._id, x]));
    return await Promise.all(
      rows.map(async (p) => ({
        ...p,
        accounts: p.accountIds.map((id) => accounts.get(id)).filter(Boolean).map((x) => ({ _id: x!._id, name: x!.name, platform: x!.platform })),
        thumbUrl: p.mediaStorageIds[0] ? await ctx.storage.getUrl(p.mediaStorageIds[0]) : null,
        authorName: (await ctx.db.get(p.updatedBy))?.name ?? "Unknown",
      })),
    );
  },
});

export const get = query({
  args: { id: v.id("socialPosts") },
  handler: async (ctx, { id }) => {
    await requirePermission(ctx, "social.read");
    const p = await ctx.db.get(id);
    if (!p) return null;
    const media = await Promise.all(
      p.mediaStorageIds.map(async (sid) => {
        const meta = await ctx.db.system.get(sid);
        return { storageId: sid, url: await ctx.storage.getUrl(sid), contentType: meta?.contentType ?? "" };
      }),
    );
    const jobs = await ctx.db.query("publishingJobs").withIndex("by_post", (q) => q.eq("postId", id)).collect();
    const updater = await ctx.db.get(p.updatedBy);
    return { ...p, media, jobs, updatedByName: updater?.name ?? "Unknown" };
  },
});

export const counts = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "social.read");
    const statuses = ["draft", "pending_approval", "approved", "scheduled", "publishing", "published", "failed", "cancelled"] as const;
    const out: Record<string, number> = {};
    for (const s of statuses) {
      out[s] = (await ctx.db.query("socialPosts").withIndex("by_status_scheduledAt", (q) => q.eq("status", s)).collect()).length;
    }
    return out;
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "social.write");
    return await ctx.storage.generateUploadUrl();
  },
});

export const save = mutation({
  args: {
    id: v.optional(v.id("socialPosts")),
    expectedVersion: v.optional(v.number()),
    data: input,
    intent: v.union(v.literal("draft"), v.literal("schedule")),
  },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "social.write");
    const d = normalise(a.data);
    for (const sid of d.mediaStorageIds) {
      const meta = await ctx.db.system.get(sid);
      if (!meta) throw new ConvexError("A media file is missing — please re-upload it.");
      const ok = meta.contentType?.startsWith("image/jpeg") || meta.contentType?.startsWith("image/png") || meta.contentType?.startsWith("video/mp4");
      if (!ok) throw new ConvexError("Supported media: JPEG, PNG images and MP4 video.");
      if (meta.size > 100 * 1024 * 1024) throw new ConvexError("Media files must be under 100 MB.");
    }
    let status: Doc<"socialPosts">["status"] = "draft";
    if (a.intent === "schedule") {
      if (!d.caption && d.mediaStorageIds.length === 0) throw new ConvexError("Add a caption or media before scheduling.");
      if (d.accountIds.length === 0) throw new ConvexError("Select at least one connected account.");
      if (!d.scheduledAt || d.scheduledAt < Date.now() + 2 * 60_000) throw new ConvexError("Schedule at least 2 minutes in the future.");
      for (const accId of d.accountIds) {
        const acc = await ctx.db.get(accId);
        if (!acc || acc.status !== "connected") throw new ConvexError(`Account "${acc?.name ?? "unknown"}" is not connected. Reconnect it first.`);
        const metas = await Promise.all(d.mediaStorageIds.map((sid) => ctx.db.system.get(sid)));
        const problem = validateForPlatform(acc.platform, metas.map((m) => ({ contentType: m?.contentType ?? "" })));
        if (problem) throw new ConvexError(`${acc.name}: ${problem}`);
      }
      status = (await requireApproval(ctx)) && !can(user, "social.approve") ? "pending_approval" : "scheduled";
    }
    const now = Date.now();
    if (a.id) {
      const p = await ctx.db.get(a.id);
      if (!p) throw notFound("Post");
      if (p.version !== a.expectedVersion) throw conflictError("post");
      if (p.status === "publishing" || p.status === "published") throw new ConvexError("Published posts can't be edited. Duplicate it instead.");
      await ctx.db.patch(p._id, { ...d, status, approvedBy: status === "scheduled" ? user._id : undefined, lastError: undefined, updatedBy: user._id, updatedAt: now, version: p.version + 1 });
      await audit(ctx, user._id, "update", "socialPosts", p._id, `Post ${status === "draft" ? "saved as draft" : status}`);
      return p._id;
    }
    const id = await ctx.db.insert("socialPosts", { ...d, status, approvedBy: status === "scheduled" ? user._id : undefined, createdBy: user._id, updatedBy: user._id, updatedAt: now, version: 1 });
    await audit(ctx, user._id, "create", "socialPosts", id, `Post created (${status})`);
    return id;
  },
});

export const approve = mutation({
  args: { id: v.id("socialPosts"), expectedVersion: v.number() },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "social.approve");
    const p = await ctx.db.get(a.id);
    if (!p) throw notFound("Post");
    if (p.version !== a.expectedVersion) throw conflictError("post");
    if (p.status !== "pending_approval") throw new ConvexError("This post is not awaiting approval.");
    if (!p.scheduledAt || p.scheduledAt < Date.now()) throw new ConvexError("The scheduled time has passed. Reschedule the post first.");
    await ctx.db.patch(p._id, { status: "scheduled", approvedBy: user._id, updatedBy: user._id, updatedAt: Date.now(), version: p.version + 1 });
    await audit(ctx, user._id, "approve", "socialPosts", p._id, "Approved and scheduled post");
  },
});

export const cancel = mutation({
  args: { id: v.id("socialPosts") },
  handler: async (ctx, { id }) => {
    const user = await requirePermission(ctx, "social.write");
    const p = await ctx.db.get(id);
    if (!p) throw notFound("Post");
    if (p.status === "publishing" || p.status === "published") throw new ConvexError("This post is already being published.");
    await ctx.db.patch(id, { status: "cancelled", updatedBy: user._id, updatedAt: Date.now(), version: p.version + 1 });
    await audit(ctx, user._id, "cancel", "socialPosts", id, "Cancelled post");
  },
});

export const reschedule = mutation({
  args: { id: v.id("socialPosts"), expectedVersion: v.number(), scheduledAt: v.number() },
  handler: async (ctx, a) => {
    const user = await requirePermission(ctx, "social.write");
    const p = await ctx.db.get(a.id);
    if (!p) throw notFound("Post");
    if (p.version !== a.expectedVersion) throw conflictError("post");
    if (!["draft", "scheduled", "pending_approval", "approved", "failed"].includes(p.status)) throw new ConvexError("This post can't be rescheduled.");
    if (a.scheduledAt < Date.now() + 2 * 60_000) throw new ConvexError("Schedule at least 2 minutes in the future.");
    await ctx.db.patch(p._id, { scheduledAt: a.scheduledAt, status: p.status === "failed" ? "draft" : p.status, updatedBy: user._id, updatedAt: Date.now(), version: p.version + 1 });
    await audit(ctx, user._id, "reschedule", "socialPosts", p._id, `Rescheduled to ${new Date(a.scheduledAt).toISOString()}`);
  },
});

export const duplicate = mutation({
  args: { id: v.id("socialPosts") },
  handler: async (ctx, { id }) => {
    const user = await requirePermission(ctx, "social.write");
    const p = await ctx.db.get(id);
    if (!p) throw notFound("Post");
    const now = Date.now();
    return await ctx.db.insert("socialPosts", {
      caption: p.caption, hashtags: p.hashtags, accountIds: p.accountIds, mediaStorageIds: p.mediaStorageIds,
      propertyId: p.propertyId, campaignId: p.campaignId, timezone: p.timezone, status: "draft",
      createdBy: user._id, updatedBy: user._id, updatedAt: now, version: 1,
    });
  },
});

// ---------------- Publishing engine ----------------

/** Cron: move due scheduled posts into publishing and create idempotent jobs. */
export const enqueueDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db.query("socialPosts").withIndex("by_status_scheduledAt", (q) => q.eq("status", "scheduled").lte("scheduledAt", now)).take(25);
    let created = 0;
    for (const p of due) {
      await ctx.db.patch(p._id, { status: "publishing" });
      for (const accountId of p.accountIds) {
        const idempotencyKey = `${p._id}:${accountId}:${p.version}`;
        const exists = await ctx.db.query("publishingJobs").withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey)).first();
        if (exists) continue;
        await ctx.db.insert("publishingJobs", { postId: p._id, accountId, idempotencyKey, status: "queued", attempts: 0, nextAttemptAt: now });
        created++;
      }
    }
    const retry = await ctx.db.query("publishingJobs").withIndex("by_status_next", (q) => q.eq("status", "queued").lte("nextAttemptAt", now)).first();
    if (created || retry) await ctx.scheduler.runAfter(0, internal.socialPosts.runJobs, {});
  },
});

export const claimJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db.query("publishingJobs").withIndex("by_status_next", (q) => q.eq("status", "queued").lte("nextAttemptAt", Date.now())).take(10);
    for (const j of jobs) await ctx.db.patch(j._id, { status: "running", attempts: j.attempts + 1 });
    return jobs.map((j) => j._id);
  },
});

export const jobContext = internalQuery({
  args: { jobId: v.id("publishingJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    const post = await ctx.db.get(job.postId);
    const account = await ctx.db.get(job.accountId);
    if (!post || !account) return null;
    const media = (
      await Promise.all(
        post.mediaStorageIds.map(async (sid) => {
          const [url, meta] = await Promise.all([ctx.storage.getUrl(sid), ctx.db.system.get(sid)]);
          return url ? { url, contentType: meta?.contentType ?? "application/octet-stream" } : null;
        }),
      )
    ).filter((m): m is { url: string; contentType: string } => !!m);
    const enabled = (await ctx.db.query("integrationSettings").withIndex("by_key", (q) => q.eq("key", "social.publishingEnabled")).unique())?.value === "true";
    return {
      enabled,
      cancelled: post.status === "cancelled",
      platform: account.platform,
      externalId: account.externalId,
      accessToken: account.accessToken,
      accountId: account._id,
      accountStatus: account.status,
      accountName: account.name,
      message: [post.caption, post.hashtags.map((h) => `#${h}`).join(" ")].filter(Boolean).join("\n\n"),
      media,
    };
  },
});

export const finishJob = internalMutation({
  args: { jobId: v.id("publishingJobs"), ok: v.boolean(), externalPostId: v.optional(v.string()), error: v.optional(v.string()), retryable: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    const job = await ctx.db.get(a.jobId);
    if (!job) return;
    if (a.ok) {
      await ctx.db.patch(job._id, { status: "succeeded", externalPostId: a.externalPostId, finishedAt: Date.now(), error: undefined });
    } else if (a.retryable && job.attempts < MAX_ATTEMPTS) {
      await ctx.db.patch(job._id, { status: "queued", error: a.error, nextAttemptAt: Date.now() + 2 ** job.attempts * 60_000 });
      await ctx.scheduler.runAfter(2 ** job.attempts * 60_000, internal.socialPosts.runJobs, {});
      return;
    } else {
      await ctx.db.patch(job._id, { status: "failed", error: a.error, finishedAt: Date.now() });
    }
    // Roll the post status up once all of its jobs have finished.
    const jobs = await ctx.db.query("publishingJobs").withIndex("by_post", (q) => q.eq("postId", job.postId)).collect();
    if (jobs.some((j) => j.status === "queued" || j.status === "running")) return;
    const post = await ctx.db.get(job.postId);
    if (!post) return;
    const failed = jobs.filter((j) => j.status === "failed");
    if (failed.length === 0) {
      await ctx.db.patch(post._id, { status: "published", publishedAt: Date.now(), lastError: undefined });
      return;
    }
    const error = failed.map((f) => f.error).join(" · ");
    await ctx.db.patch(post._id, { status: "failed", lastError: error });
    const people = new Set<Id<"users">>([post.createdBy, post.updatedBy, ...(await usersWithRoles(ctx, ["super_admin"]))]);
    await notify(ctx, people, { type: "post_failed", title: "A scheduled social post failed to publish", body: error.slice(0, 200), link: `/marketing/social/posts/${post._id}` });
    for (const uid of [post.updatedBy]) {
      const u = await ctx.db.get(uid);
      if (!u?.email) continue;
      await enqueueEmail(ctx, {
        kind: "publish_failure", to: u.email, subject: "Social post failed to publish", dedupeKey: `pubfail:${post._id}:${post.version}:${uid}`,
        html: renderEmail({ badge: "Publishing failed", heading: "A scheduled post could not be published", bodyText: `${post.caption.slice(0, 200)}\n\nReason: ${error}`, ctaLabel: "Review post", ctaUrl: siteUrl(`/marketing/social/posts/${post._id}`) }),
      });
    }
  },
});

export const runJobs = internalAction({
  args: {},
  handler: async (ctx) => {
    const ids = await ctx.runMutation(internal.socialPosts.claimJobs, {});
    for (const jobId of ids) {
      const c = await ctx.runQuery(internal.socialPosts.jobContext, { jobId });
      if (!c) {
        await ctx.runMutation(internal.socialPosts.finishJob, { jobId, ok: false, error: "Post or account no longer exists." });
        continue;
      }
      if (c.cancelled) {
        await ctx.runMutation(internal.socialPosts.finishJob, { jobId, ok: false, error: "Post was cancelled." });
        continue;
      }
      if (!c.enabled) {
        await ctx.runMutation(internal.socialPosts.finishJob, { jobId, ok: false, error: "Live publishing is switched off (Admin → Integrations). Nothing was posted." });
        continue;
      }
      if (c.accountStatus !== "connected" || !c.accessToken) {
        await ctx.runMutation(internal.socialPosts.finishJob, { jobId, ok: false, error: `${c.accountName}: account needs to be reconnected.` });
        continue;
      }
      try {
        const externalPostId = await publishToPlatform({ platform: c.platform, externalId: c.externalId, accessToken: c.accessToken, message: c.message, media: c.media });
        await ctx.runMutation(internal.socialPosts.finishJob, { jobId, ok: true, externalPostId });
      } catch (e) {
        const retryable = e instanceof PublishError ? e.retryable : true;
        if (e instanceof PublishError && e.tokenInvalid) {
          await ctx.runMutation(internal.socialAuth.markAccountExpired, { id: c.accountId, error: e.message });
        }
        await ctx.runMutation(internal.socialPosts.finishJob, { jobId, ok: false, error: (e as Error).message, retryable });
      }
    }
  },
});

/** Cron safety net: jobs stuck in "running" for 15+ min are re-queued once. */
export const recoverStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const running = await ctx.db.query("publishingJobs").withIndex("by_status_next", (q) => q.eq("status", "running")).take(50);
    for (const j of running) {
      if (Date.now() - j.nextAttemptAt > 15 * 60_000) {
        // Do NOT blindly retry: the platform may have accepted the post. Mark failed for human review.
        await ctx.db.patch(j._id, { status: "failed", error: "Publishing timed out — check the platform before retrying to avoid a duplicate post.", finishedAt: Date.now() });
        const post = await ctx.db.get(j.postId);
        if (post?.status === "publishing") await ctx.db.patch(post._id, { status: "failed", lastError: "Publishing timed out." });
      }
    }
  },
});

export const accounts = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "social.read");
    const rows = await ctx.db.query("marketingAccounts").collect();
    return rows.map(({ accessToken: _t, refreshToken: _r, ...a }) => a);
  },
});

export const disconnectAccount = mutation({
  args: { id: v.id("marketingAccounts") },
  handler: async (ctx, { id }) => {
    const user = await requirePermission(ctx, "social.connect");
    const a = await ctx.db.get(id);
    if (!a) throw notFound("Account");
    await ctx.db.patch(id, { status: "disconnected", accessToken: undefined, refreshToken: undefined });
    await audit(ctx, user._id, "disconnect", "marketingAccounts", id, `Disconnected ${a.platform} account ${a.name}`);
  },
});
