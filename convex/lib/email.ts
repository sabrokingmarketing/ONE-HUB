import { escapeHtml } from "./text";

/**
 * Branded ONE HUB email layout + Resend transport.
 *
 * Safety: ONEHUB_EMAIL_MODE controls delivery and defaults to "log", so a fresh
 * deployment never emails real people by accident.
 *   log  → nothing is sent; the job is marked "logged"
 *   test → every email is redirected to ONEHUB_EMAIL_TEST_RECIPIENT
 *   live → emails are delivered to their real recipients
 */

// Brand orange sampled from the official ONE logo.
const BRAND_ORANGE = "#F7931E";
const logoUrl = () => `${(process.env.SITE_URL ?? "").replace(/\/$/, "")}/logo-one.png`;

export type EmailMode = "log" | "test" | "live";

export function emailMode(): EmailMode {
  const m = process.env.ONEHUB_EMAIL_MODE;
  return m === "live" || m === "test" ? m : "log";
}

export function renderEmail(opts: {
  heading: string;
  intro?: string;
  bodyHtml?: string;
  bodyText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  badge?: string;
}) {
  const body =
    opts.bodyHtml ??
    (opts.bodyText ?? "")
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 16px">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
      .join("");
  const badge = opts.badge
    ? `<div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#FFF1E8;color:${BRAND_ORANGE};font-size:12px;font-weight:600;letter-spacing:.02em;margin-bottom:16px">${escapeHtml(opts.badge)}</div>`
    : "";
  const cta =
    opts.ctaUrl && opts.ctaLabel
      ? `<a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:${BRAND_ORANGE};color:#fff;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:10px;margin-top:8px">${escapeHtml(opts.ctaLabel)}</a>`
      : "";
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"/><meta charset="utf-8"/></head>
<body style="margin:0;background:#F5F5F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Helvetica,Arial,sans-serif;color:#1C1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #E7E5E4">
<tr><td style="height:4px;background:${BRAND_ORANGE}"></td></tr>
<tr><td style="padding:28px 32px 8px">${process.env.SITE_URL ? `<img src="${logoUrl()}" alt="ONE" height="28" style="height:28px;width:auto;vertical-align:middle;border:0"/><span style="font-weight:700;font-size:12px;letter-spacing:.22em;color:#71717A;vertical-align:middle;padding-left:10px">HUB</span>` : `<span style="font-weight:800;font-size:18px;letter-spacing:.04em;color:${BRAND_ORANGE}">ONE</span><span style="font-weight:500;font-size:18px;color:#71717A"> HUB</span>`}</td></tr>
<tr><td style="padding:16px 32px 32px;font-size:15px;line-height:1.6">
${badge}
<h1 style="font-size:22px;line-height:1.3;margin:0 0 12px;color:#1C1917">${escapeHtml(opts.heading)}</h1>
${opts.intro ? `<p style="margin:0 0 16px;color:#57534E">${escapeHtml(opts.intro)}</p>` : ""}
${body}
${cta}
</td></tr>
<tr><td style="padding:20px 32px;background:#FAFAF9;border-top:1px solid #E7E5E4;font-size:12px;color:#A8A29E">
ONE Property Holdings · Internal communication sent via ONE HUB.<br/>This message may contain confidential information intended only for the recipient.
</td></tr></table></td></tr></table></body></html>`;
}

export async function deliverEmail(
  to: string,
  subject: string,
  html: string,
): Promise<{ status: "sent" | "logged"; providerId?: string }> {
  const mode = emailMode();
  if (mode === "log") {
    console.log(`[email:log] to=${to} subject=${subject}`);
    return { status: "logged" };
  }
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ONEHUB_EMAIL_FROM;
  if (!apiKey || !from) throw new Error("Resend is not configured (RESEND_API_KEY / ONEHUB_EMAIL_FROM).");
  let recipient = to;
  if (mode === "test") {
    const testTo = process.env.ONEHUB_EMAIL_TEST_RECIPIENT;
    if (!testTo) throw new Error("ONEHUB_EMAIL_TEST_RECIPIENT is required in test mode.");
    recipient = testTo;
    subject = `[TEST → ${to}] ${subject}`;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [recipient], subject, html }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) {
    const err = new Error(`Resend ${res.status}: ${data.message ?? "send failed"}`);
    (err as Error & { retryable?: boolean }).retryable = res.status === 429 || res.status >= 500;
    throw err;
  }
  return { status: "sent", providerId: data.id };
}
