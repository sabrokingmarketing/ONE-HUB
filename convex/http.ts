import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { verifyWebhook } from "./lib/webhook";

const http = httpRouter();
auth.addHttpRoutes(http);

/**
 * Resend delivery webhooks → email job status (delivered, bounced, ...).
 * Register https://<deployment>.convex.site/resend/webhook in the ONE HUB Resend
 * account and store its signing secret as RESEND_WEBHOOK_SECRET.
 */
http.route({
  path: "/resend/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return new Response("Webhook not configured", { status: 503 });
    const body = await req.text();
    const ok = await verifyWebhook(
      secret,
      { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") },
      body,
    );
    if (!ok) return new Response("Invalid signature", { status: 401 });
    let event: { type?: string; created_at?: string; data?: { email_id?: string; bounce?: { message?: string; type?: string }; failed?: { reason?: string } } };
    try {
      event = JSON.parse(body);
    } catch {
      return new Response("Bad payload", { status: 400 });
    }
    const emailId = event.data?.email_id;
    if (!event.type?.startsWith("email.") || !emailId) return new Response(null, { status: 204 });
    const at = Date.parse(event.created_at ?? "") || Date.now();
    const detail = event.data?.bounce?.message ?? event.data?.failed?.reason ?? (event.type === "email.complained" ? "Recipient marked the email as spam" : undefined);
    await ctx.runMutation(internal.emails.applyWebhookEvent, { type: event.type, emailId, at, detail });
    return new Response(null, { status: 204 });
  }),
});

export default http;
