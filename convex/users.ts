import { v, ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { roleValidator } from "./schema";
import { requirePermission, requireUser, notFound } from "./lib/auth";
import { resolvePermissions, ROLE_LABELS } from "./lib/permissionMatrix";
import { audit } from "./lib/audit";
import { enqueueEmail, siteUrl } from "./lib/queue";
import { renderEmail } from "./lib/email";
import { isEmail, randomToken } from "./lib/text";

const INVITE_TTL = 7 * 24 * 60 * 60 * 1000;

/** The signed-in user + their resolved permissions (null if signed out). */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? user.email ?? "User",
      email: user.email ?? "",
      role: user.role ?? null,
      status: user.status ?? "active",
      jobTitle: user.jobTitle,
      timezone: user.timezone ?? "Africa/Johannesburg",
      permissions: user.status === "suspended" ? [] : [...resolvePermissions(user)],
    };
  },
});

export const touchLogin = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    // Only record a new login if the last one is older than 30 minutes.
    if (!user.lastLoginAt || Date.now() - user.lastLoginAt > 30 * 60_000) {
      await ctx.db.patch(user._id, { lastLoginAt: Date.now() });
    }
  },
});

export const updateProfile = mutation({
  args: { name: v.string(), jobTitle: v.optional(v.string()) },
  handler: async (ctx, a) => {
    const user = await requireUser(ctx);
    const name = a.name.trim();
    if (!name) throw new ConvexError("Name is required.");
    await ctx.db.patch(user._id, { name, jobTitle: a.jobTitle?.trim() || undefined });
  },
});

/** Directory of active colleagues — used for pickers (assignment, invites). */
export const colleagues = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => u.role && u.status !== "suspended")
      .map((u) => ({ _id: u._id, name: u.name ?? u.email ?? "User", email: u.email ?? "", role: u.role! }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "users.manage");
    const users = await ctx.db.query("users").collect();
    const invitations = await ctx.db
      .query("invitations")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    return {
      users: users
        .filter((u) => u.role)
        .map((u) => ({
          _id: u._id,
          name: u.name ?? "",
          email: u.email ?? "",
          role: u.role!,
          status: u.status ?? "active",
          lastLoginAt: u.lastLoginAt,
          createdAt: u._creationTime,
        })),
      invitations: invitations.map(({ token: _t, ...i }) => ({ ...i, expired: i.expiresAt < Date.now() })),
    };
  },
});

async function sendInviteEmail(
  ctx: Parameters<typeof enqueueEmail>[0],
  invite: { email: string; name: string; role: keyof typeof ROLE_LABELS; token: string },
  inviterName: string,
  attempt: number,
) {
  const url = siteUrl(`/accept-invite?token=${invite.token}`);
  await enqueueEmail(ctx, {
    kind: "invitation",
    to: invite.email,
    subject: "You're invited to ONE HUB",
    dedupeKey: `invite:${invite.token}:${attempt}`,
    html: renderEmail({
      badge: ROLE_LABELS[invite.role],
      heading: `Welcome to ONE HUB, ${invite.name.split(" ")[0]}`,
      intro: `${inviterName} has invited you to ONE HUB, the internal platform for ONE Property Holdings.`,
      bodyText: "Click below to create your personal login. This invitation expires in 7 days and can only be used with this email address.",
      ctaLabel: "Activate my account",
      ctaUrl: url,
    }),
  });
}

export const invite = mutation({
  args: { email: v.string(), name: v.string(), role: roleValidator },
  handler: async (ctx, a) => {
    const admin = await requirePermission(ctx, "users.manage");
    const email = a.email.trim().toLowerCase();
    const name = a.name.trim();
    if (!isEmail(email)) throw new ConvexError("Enter a valid email address.");
    if (!name) throw new ConvexError("Name is required.");
    const existingUser = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).first();
    if (existingUser?.role) throw new ConvexError("A user with this email already exists.");
    const pending = await ctx.db
      .query("invitations")
      .withIndex("by_email", (q) => q.eq("email", email))
      .filter((q) => q.eq(q.field("status"), "pending"))
      .collect();
    for (const p of pending) await ctx.db.patch(p._id, { status: "revoked" });

    const token = randomToken(32);
    const id = await ctx.db.insert("invitations", {
      email,
      name,
      role: a.role,
      token,
      status: "pending",
      invitedBy: admin._id,
      expiresAt: Date.now() + INVITE_TTL,
      lastSentAt: Date.now(),
    });
    await sendInviteEmail(ctx, { email, name, role: a.role, token }, admin.name ?? "An administrator", 0);
    await audit(ctx, admin._id, "invite.create", "invitations", id, `Invited ${email} as ${ROLE_LABELS[a.role]}`);
    return id;
  },
});

export const resendInvite = mutation({
  args: { id: v.id("invitations") },
  handler: async (ctx, { id }) => {
    const admin = await requirePermission(ctx, "users.manage");
    const inv = await ctx.db.get(id);
    if (!inv || inv.status !== "pending") throw notFound("Pending invitation");
    if (inv.lastSentAt && Date.now() - inv.lastSentAt < 60_000) {
      throw new ConvexError("Please wait a minute before resending.");
    }
    const now = Date.now();
    await ctx.db.patch(id, { expiresAt: now + INVITE_TTL, lastSentAt: now });
    await sendInviteEmail(ctx, inv, admin.name ?? "An administrator", now);
    await audit(ctx, admin._id, "invite.resend", "invitations", id, `Resent invitation to ${inv.email}`);
  },
});

export const revokeInvite = mutation({
  args: { id: v.id("invitations") },
  handler: async (ctx, { id }) => {
    const admin = await requirePermission(ctx, "users.manage");
    const inv = await ctx.db.get(id);
    if (!inv) throw notFound("Invitation");
    await ctx.db.patch(id, { status: "revoked" });
    await audit(ctx, admin._id, "invite.revoke", "invitations", id, `Revoked invitation for ${inv.email}`);
  },
});

/** Public: validate an invite token before showing the activation form. */
export const getInvitation = query({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    if (token.length < 16) return null;
    const inv = await ctx.db.query("invitations").withIndex("by_token", (q) => q.eq("token", token)).unique();
    if (!inv) return null;
    return {
      email: inv.email,
      name: inv.name,
      role: inv.role,
      valid: inv.status === "pending" && inv.expiresAt > Date.now(),
    };
  },
});

async function assertNotLastAdmin(ctx: Parameters<typeof requireUser>[0], userId: string) {
  const admins = await ctx.db.query("users").withIndex("by_role", (q) => q.eq("role", "super_admin")).collect();
  const active = admins.filter((u) => u.status !== "suspended" && u._id !== userId);
  if (active.length === 0) throw new ConvexError("ONE HUB must always have at least one active Super Admin.");
}

export const updateAccess = mutation({
  args: {
    userId: v.id("users"),
    role: v.optional(roleValidator),
  },
  handler: async (ctx, a) => {
    const admin = await requirePermission(ctx, "users.manage");
    const user = await ctx.db.get(a.userId);
    if (!user?.role) throw notFound("User");
    if (a.role && a.role !== user.role && user.role === "super_admin") await assertNotLastAdmin(ctx, user._id);
    const patch: Record<string, unknown> = {};
    if (a.role) patch.role = a.role;
    await ctx.db.patch(user._id, patch);
    await audit(ctx, admin._id, "user.access", "users", user._id, `Updated access for ${user.email}: ${JSON.stringify(patch)}`);
  },
});

export const setStatus = mutation({
  args: { userId: v.id("users"), status: v.union(v.literal("active"), v.literal("suspended")) },
  handler: async (ctx, a) => {
    const admin = await requirePermission(ctx, "users.manage");
    const user = await ctx.db.get(a.userId);
    if (!user?.role) throw notFound("User");
    if (a.status === "suspended") {
      if (user._id === admin._id) throw new ConvexError("You cannot suspend your own account.");
      if (user.role === "super_admin") await assertNotLastAdmin(ctx, user._id);
      // Revoke all active sessions immediately.
      const sessions = await ctx.db.query("authSessions").withIndex("userId", (q) => q.eq("userId", user._id)).collect();
      for (const s of sessions) {
        const tokens = await ctx.db.query("authRefreshTokens").withIndex("sessionId", (q) => q.eq("sessionId", s._id)).collect();
        for (const t of tokens) await ctx.db.delete(t._id);
        await ctx.db.delete(s._id);
      }
    }
    await ctx.db.patch(user._id, { status: a.status });
    await audit(ctx, admin._id, `user.${a.status === "active" ? "reactivate" : "suspend"}`, "users", user._id, `${a.status === "active" ? "Reactivated" : "Suspended"} ${user.email}`);
  },
});

export const activity = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    await requirePermission(ctx, "users.manage");
    return await ctx.db.query("auditLogs").withIndex("by_actor", (q) => q.eq("actorId", userId)).order("desc").take(50);
  },
});
