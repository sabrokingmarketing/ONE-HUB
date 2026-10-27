import { escapeHtml } from "./text";

/**
 * Branded ONE HUB email layout + Resend transport.
 *
 * ONE HUB uses its own dedicated Resend account. Never point RESEND_API_KEY at
 * a key belonging to another business or website.
 *
 * Safety: ONEHUB_EMAIL_MODE controls delivery and defaults to "log", so a fresh
 * deployment never emails real people by accident.
 *   log  → nothing is sent; the job is marked "logged"
 *   test → every email is redirected to ONEHUB_EMAIL_TEST_RECIPIENT
 *   live → emails are delivered to their real recipients
 */

// Brand orange sampled from the official ONE logo.
const BRAND_ORANGE = "#F7931E";
const INK = "#1C1917";
const MUTED = "#57534E";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const SENDER_LABEL = "ONE Property Holdings | Internal Communications";
const logoUrl = () => `${(process.env.SITE_URL ?? "").replace(/\/$/, "")}/logo-one.png`;

export type EmailMode = "log" | "test" | "live";

export function emailMode(): EmailMode {
  const m = process.env.ONEHUB_EMAIL_MODE;
  return m === "live" || m === "test" ? m : "log";
}

/**
 * Provider sending caps. Defaults match the Resend free plan (100/day, 3,000/month).
 * Set either to 0 to disable that cap (e.g. after an approved upgrade to a paid plan).
 */
export function emailLimits() {
  const n = (v: string | undefined, d: number) => {
    const x = Number(v);
    return v !== undefined && v !== "" && Number.isFinite(x) && x >= 0 ? Math.floor(x) : d;
  };
  return {
    daily: n(process.env.ONEHUB_EMAIL_DAILY_LIMIT, 100),
    monthly: n(process.env.ONEHUB_EMAIL_MONTHLY_LIMIT, 3000),
  };
}

export function renderEmail(opts: {
  heading: string;
  intro?: string;
  bodyHtml?: string;
  bodyText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  badge?: string;
  /** Inbox preview text shown after the subject line. Defaults to the intro/body. */
  preheader?: string;
}) {
  const body =
    opts.bodyHtml ??
    (opts.bodyText ?? "")
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:26px;color:${INK}">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
      .join("");
  const preheader = (opts.preheader ?? opts.intro ?? opts.bodyText ?? "").replace(/\s+/g, " ").trim().slice(0, 140);
  const badge = opts.badge
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px"><tr><td bgcolor="#FFF4E6" style="background:#FFF4E6;border-radius:999px;padding:5px 12px;font-family:${FONT};font-size:12px;line-height:16px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:#B45309">${escapeHtml(opts.badge)}</td></tr></table>`
    : "";
  // "Bulletproof" button: VML for Outlook desktop, a styled link everywhere else.
  const cta =
    opts.ctaUrl && opts.ctaLabel
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px"><tr><td>
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${escapeHtml(opts.ctaUrl)}" style="height:46px;v-text-anchor:middle;width:240px" arcsize="22%" stroke="f" fillcolor="${BRAND_ORANGE}"><w:anchorlock/><center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold">${escapeHtml(opts.ctaLabel)}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${escapeHtml(opts.ctaUrl)}" style="display:inline-block;background:${BRAND_ORANGE};color:#ffffff;font-family:${FONT};font-size:15px;line-height:20px;font-weight:700;text-decoration:none;padding:13px 26px;border-radius:10px;mso-hide:all">${escapeHtml(opts.ctaLabel)}</a><!--<![endif]-->
</td></tr></table>`
      : "";
  const logo = process.env.SITE_URL
    ? `<img src="${logoUrl()}" alt="ONE Property Holdings" width="84" height="36" style="display:block;width:84px;height:auto;border:0;outline:none;text-decoration:none"/>`
    : `<span style="font-family:${FONT};font-weight:800;font-size:22px;letter-spacing:.06em;color:${BRAND_ORANGE}">ONE</span>`;
  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta http-equiv="X-UA-Compatible" content="IE=edge"/>
<meta name="color-scheme" content="light"/><meta name="supported-color-schemes" content="light"/>
<title>${escapeHtml(opts.heading)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
  body{margin:0;padding:0;width:100%!important;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
  table,td{mso-table-lspace:0;mso-table-rspace:0;border-collapse:collapse}
  img{-ms-interpolation-mode:bicubic}
  a{color:${BRAND_ORANGE}}
  @media only screen and (max-width:620px){
    .container{width:100%!important}
    .px{padding-left:22px!important;padding-right:22px!important}
    .h1{font-size:22px!important;line-height:30px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:#FFFFFF" bgcolor="#FFFFFF">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#FFFFFF;opacity:0">${escapeHtml(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="background:#FFFFFF">
<tr><td align="center" style="padding:24px 12px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#FFFFFF;border:1px solid #ECE7E2;border-radius:16px">
<tr><td height="5" bgcolor="${BRAND_ORANGE}" style="height:5px;line-height:5px;font-size:0;background:${BRAND_ORANGE};border-radius:16px 16px 0 0">&nbsp;</td></tr>
<tr><td class="px" style="padding:28px 40px 8px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td valign="middle">${logo}</td>
    <td valign="middle" align="right" style="font-family:${FONT};font-size:11px;line-height:16px;letter-spacing:.08em;text-transform:uppercase;color:#A8A29E">Internal Communications</td>
  </tr></table>
</td></tr>
<tr><td class="px" style="padding:22px 40px 36px">
${badge}
<h1 class="h1" style="margin:0 0 14px;font-family:${FONT};font-size:26px;line-height:34px;font-weight:700;color:${INK}">${escapeHtml(opts.heading)}</h1>
${opts.intro ? `<p style="margin:0 0 18px;font-family:${FONT};font-size:16px;line-height:26px;color:${MUTED}">${escapeHtml(opts.intro)}</p>` : ""}
${body}
${cta}
</td></tr>
<tr><td class="px" bgcolor="#FAFAF9" style="padding:22px 40px 26px;background:#FAFAF9;border-top:1px solid #ECE7E2;border-radius:0 0 16px 16px">
<p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:20px;font-weight:700;color:${INK}">ONE Property Holdings</p>
<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:#78716C">Internal communication sent via ONE HUB to employees and directors of ONE Property Holdings.<br/>This message may contain confidential information intended only for the recipient. If you received it in error, please notify the sender and delete it.</p>
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr></table>
</body></html>`;
}

export type DeliveryError = Error & { retryable?: boolean; quota?: "daily" | "monthly" };

export async function deliverEmail(
  to: string,
  subject: string,
  html: string,
  idempotencyKey?: string,
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
  const headers: Record<string, string> = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  // Resend ignores a repeated request with the same key for 24h, so a retry after a
  // timeout (where the first attempt actually went out) can never double-send.
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey.slice(0, 256);
  const replyTo = process.env.ONEHUB_EMAIL_REPLY_TO;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers,
    body: JSON.stringify({ from, to: [recipient], subject, html, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok) {
    const err: DeliveryError = new Error(`Resend ${res.status}${data.name ? ` ${data.name}` : ""}: ${data.message ?? "send failed"}`);
    if (data.name === "daily_quota_exceeded") err.quota = "daily";
    else if (data.name === "monthly_quota_exceeded") err.quota = "monthly";
    err.retryable = res.status === 429 || res.status >= 500;
    throw err;
  }
  return { status: "sent", providerId: data.id };
}
