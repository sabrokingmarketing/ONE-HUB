import type { Tone } from "@/components/ui/badge";

/**
 * Honest email status wording. "sent" only means Resend accepted the email;
 * "Delivered" is shown only after Resend's delivery webhook confirms it.
 */
export const EMAIL_STATUS: Record<string, { label: string; tone: Tone; hint: string }> = {
  queued: { label: "Queued", tone: "blue", hint: "Waiting in ONE HUB's send queue." },
  sending: { label: "Sending", tone: "blue", hint: "Being handed to Resend now." },
  sent: { label: "Sent", tone: "violet", hint: "Accepted by Resend. Awaiting delivery confirmation." },
  delivery_delayed: { label: "Delayed", tone: "amber", hint: "The recipient's mail server is temporarily deferring it." },
  delivered: { label: "Delivered", tone: "green", hint: "The recipient's mail server confirmed delivery." },
  bounced: { label: "Bounced", tone: "red", hint: "The address rejected the email." },
  complained: { label: "Marked as spam", tone: "red", hint: "The recipient reported the email as spam." },
  failed: { label: "Failed", tone: "red", hint: "ONE HUB could not send it. See the error." },
  logged: { label: "Logged only", tone: "neutral", hint: "Log mode: recorded, never sent." },
};

export const emailStatus = (s: string) => EMAIL_STATUS[s] ?? { label: s, tone: "neutral" as Tone, hint: "" };
