import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Email } from "@convex-dev/auth/providers/Email";
import { ConvexError } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import { deliverEmail, renderEmail } from "./lib/email";

/**
 * Invite-only authentication.
 *  - Every person has their own account (email + password, min 10 chars).
 *  - A new account can only be created with a valid, unexpired invitation
 *    token that matches the email address — except the very first account,
 *    which must match ONEHUB_BOOTSTRAP_ADMIN_EMAIL and becomes Super Admin.
 *  - Password reset uses an 8-digit one-time code delivered by Resend.
 */

const PasswordReset = Email({
  id: "password-reset",
  maxAge: 60 * 15,
  async generateVerificationToken() {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return String(a[0] % 100_000_000).padStart(8, "0");
  },
  async sendVerificationRequest({ identifier, token }) {
    await deliverEmail(
      identifier,
      "Your ONE HUB password reset code",
      renderEmail({
        heading: "Reset your password",
        intro: "Use this code to choose a new password. It expires in 15 minutes.",
        bodyHtml: `<div style="font-size:28px;font-weight:700;letter-spacing:.3em;padding:16px 0">${token}</div><p style="color:#78716C">If you didn't request this, you can ignore this email.</p>`,
      }),
    );
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      reset: PasswordReset,
      profile(params) {
        const email = String(params.email ?? "").trim().toLowerCase();
        if (!email) throw new ConvexError("Email is required.");
        return {
          email,
          ...(params.name ? { name: String(params.name) } : {}),
          ...(params.inviteToken ? { inviteToken: String(params.inviteToken) } : {}),
        } as { email: string };
      },
      validatePasswordRequirements(password) {
        if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
          throw new ConvexError("Password must be at least 10 characters and include letters and numbers.");
        }
      },
    }),
  ],
  callbacks: {
    async createOrUpdateUser(rawCtx, args) {
      const ctx = rawCtx as unknown as MutationCtx;
      if (args.existingUserId) return args.existingUserId;

      const email = String(args.profile.email ?? "").toLowerCase();
      const inviteToken = args.profile.inviteToken as string | undefined;
      const name = (args.profile.name as string | undefined) ?? email.split("@")[0];

      const anyAdmin = await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "super_admin"))
        .first();
      const bootstrap = process.env.ONEHUB_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
      if (!anyAdmin && bootstrap && email === bootstrap) {
        const id = await ctx.db.insert("users", {
          email,
          name,
          role: "super_admin",
          status: "active",
          lastLoginAt: Date.now(),
          timezone: "Africa/Johannesburg",
        });
        await ctx.db.insert("auditLogs", {
          actorId: id,
          action: "bootstrap",
          entity: "users",
          entityId: id,
          summary: `Initial Super Admin account created for ${email}`,
          at: Date.now(),
        });
        return id;
      }

      if (!inviteToken) throw new ConvexError("ONE HUB is invite-only. Please use the link in your invitation email.");
      const invite = await ctx.db
        .query("invitations")
        .withIndex("by_token", (q) => q.eq("token", inviteToken))
        .unique();
      if (!invite || invite.status !== "pending" || invite.expiresAt < Date.now() || invite.email !== email) {
        throw new ConvexError("This invitation is invalid or has expired. Ask an administrator to resend it.");
      }
      const id = await ctx.db.insert("users", {
        email,
        name: invite.name || name,
        role: invite.role,
        status: "active",
        lastLoginAt: Date.now(),
        timezone: "Africa/Johannesburg",
      });
      await ctx.db.patch(invite._id, { status: "accepted", acceptedAt: Date.now() });
      await ctx.db.insert("auditLogs", {
        actorId: id,
        action: "invite.accept",
        entity: "users",
        entityId: id,
        summary: `${email} activated their ${invite.role} account`,
        at: Date.now(),
      });
      return id;
    },
  },
});
