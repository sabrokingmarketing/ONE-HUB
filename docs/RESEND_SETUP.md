# Resend setup: dedicated ONE HUB account

ONE HUB sends email through **its own Resend account**. It does not share an account, API key, domain or
quota with any other ONE Property Holdings or Sabroking website.

**Never do any of the following while setting this up:**
- Log in to, change, or delete keys/domains in any other Resend account.
- Edit or remove existing DNS records (website, Google/Microsoft mail, SPF, DMARC, other Resend domains).
- Paste the API key into chat, a ticket, git or frontend code. It only goes into Convex environment variables.
- Create extra Resend accounts to get around sending limits. This breaks Resend's terms.

Steps marked **(you)** need a person: email verification, CAPTCHA, login and DNS approval.

---

## 1. Create the account (you)

1. Use a company mailbox that is **not** the login for the existing Resend account, for example
   `it@oneholdings.co.za` or `hub-admin@oneholdings.co.za`. A shared admin mailbox is better than a personal
   one, because the account should outlive any one person.
2. Open **https://resend.com/signup** and sign up with that mailbox. Use a password manager and turn on
   two-factor authentication (**Settings → Account → Security**).
3. Click the verification link Resend emails you.
4. Rename the team to **ONE Property Holdings – ONE HUB** under **Settings → Team**.
5. Stay on the **Free** plan. Do not add a card or upgrade without the owners' approval.

> If you prefer one login, Resend also supports a separate *team* under an existing login (team switcher →
> *Create team*). Each team has its own keys, domains, quota and billing. A separate login is still cleaner,
> and it's what this guide assumes.

## 2. Add the sending domain (you approve, then add DNS)

Recommended sender: **`notifications@hub.oneholdings.co.za`**, display name
**ONE Property Holdings | Internal Communications**.

First confirm that ONE Property Holdings owns `oneholdings.co.za` and that you can edit its DNS (in Cloudflare,
or wherever its nameservers point). If the company domain is different, use `hub.<company-domain>`.

1. Resend → **Domains → Add domain** → `hub.oneholdings.co.za`. Pick region **eu-west-1 (Ireland)**, the
   closest to South Africa.
2. Resend then shows the exact records. They normally look like this. **Copy the values from Resend, not
   from here.**

| Type | Name (in the `oneholdings.co.za` zone) | Value | Purpose |
|---|---|---|---|
| TXT | `resend._domainkey.hub` | `p=MIGfMA0G…` (unique key from Resend) | DKIM signature |
| MX | `send.hub` | `feedback-smtp.eu-west-1.amazonses.com`, priority `10` | Bounce handling (Return-Path) |
| TXT | `send.hub` | `v=spf1 include:amazonses.com ~all` | SPF for the Return-Path domain |
| TXT *(optional)* | `_dmarc.hub` | `v=DMARC1; p=none; rua=mailto:dmarc@oneholdings.co.za` | Only if the root domain has no DMARC record. Check first |

Why these records are safe:
- They are all **new names** under `hub.` and `send.hub.`. The root SPF/MX records for `oneholdings.co.za`,
  and so your normal company email, are **not touched**.
- They don't clash with a website CNAME on `hub.oneholdings.co.za`. That record is on `hub` itself, and
  these are on `resend._domainkey.hub` and `send.hub`.

3. **Cloudflare (you):** before adding anything, export or screenshot the current DNS zone. Then add only the
   records above. Leave the proxy off (grey cloud). TXT and MX records can't be proxied anyway.
4. In Resend, click **Verify DNS records**. Propagation usually takes minutes, sometimes a few hours. The
   domain must show **Verified** before you continue.

## 3. Create the API key (you)

Resend → **API Keys → Create API key**
- Name: `one-hub-production`
- Permission: **Sending access**
- Domain: `hub.oneholdings.co.za` only

Copy the key once. Paste it straight into the command in step 5, never anywhere else.

## 4. Delivery webhook (you)

This is what lets ONE HUB show **Delivered / Bounced / Marked as spam** instead of just "Sent".

Resend → **Webhooks → Add endpoint**
- URL: `https://<your-one-hub-deployment>.convex.site/resend/webhook`
  (the `.convex.site` URL is in the Convex dashboard → Settings → URL & deploy key)
- Events: `email.sent`, `email.delivered`, `email.delivery_delayed`, `email.bounced`, `email.complained`,
  `email.failed` (plus `email.suppressed` if offered)

Copy the **signing secret** (`whsec_…`).

## 5. Connect to ONE HUB (Convex environment, server-side only)

Run these from the ONE HUB repo, logged in to the **ONE HUB** Convex project. They only set variables on
that deployment and can't affect any other app.

```bash
npx convex env set RESEND_API_KEY 're_…'                     # from step 3
npx convex env set RESEND_WEBHOOK_SECRET 'whsec_…'           # from step 4
npx convex env set ONEHUB_EMAIL_FROM '"ONE Property Holdings | Internal Communications" <notifications@hub.oneholdings.co.za>'
npx convex env set ONEHUB_EMAIL_REPLY_TO 'directors@oneholdings.co.za'   # optional: a monitored mailbox for replies
npx convex env set ONEHUB_EMAIL_MODE test                    # log | test | live
npx convex env set ONEHUB_EMAIL_TEST_RECIPIENT 'approved-person@oneholdings.co.za'
# Sending caps. The defaults match the Resend free plan. Change only after an approved plan change.
# npx convex env set ONEHUB_EMAIL_DAILY_LIMIT 100
# npx convex env set ONEHUB_EMAIL_MONTHLY_LIMIT 3000
```

The key is only read inside Convex actions (`convex/lib/email.ts`). It never reaches the browser bundle.

## 6. Controlled testing (no bulk sends)

Do these in order, with `ONEHUB_EMAIL_MODE=test`. Test mode redirects **every** email to
`ONEHUB_EMAIL_TEST_RECIPIENT`, whoever it is addressed to.

| # | Test | How | Expected |
|---|---|---|---|
| 1 | API key | Admin → Integrations → **Test Resend connection** (sends nothing) | "Key valid (sending-only)" |
| 2 | Template rendering | Directors → Employees → Send employee update → **Preview** | Branded email with logo, badge, button |
| 3 | Single test email | **Send test to me** | Arrives in the approved inbox; Email log shows Sent, then **Delivered** |
| 4 | Authentication | In Gmail: ⋮ → *Show original* | `SPF: PASS`, `DKIM: PASS` (domain `hub.oneholdings.co.za`), DMARC `PASS` (or none if the domain has no DMARC record) |
| 5 | Recipient selection | Choose *Selected employees* → one person → send | One email, redirected to the test inbox, subject `[TEST → their address] …` |
| 6 | Duplicate protection | Send the same update to the same people again | Blocked: "already sent … in the last 24 hours" |
| 7 | Bounce/webhook handling | Temporarily set `ONEHUB_EMAIL_TEST_RECIPIENT=bounced@resend.dev`, send a test, then set it back | Status **Bounced** with the reason in the Email log |
| 8 | Spam-complaint handling | Same with `complained@resend.dev` | Status **Marked as spam** |
| 9 | Permissions | Sign in as a Marketing-team user | No access to Send Employee Update or the Email log |
| 10 | Sending limits | Admin → Usage & limits | Today/month counters move; the daily allowance shows |

`delivered@resend.dev`, `bounced@resend.dev` and `complained@resend.dev` are Resend's official test inboxes.
They simulate each outcome without emailing a real person.

## 7. Go live (owners' approval required)

Switch only when tests 1–10 pass and the owners approve real sends:

```bash
npx convex env set ONEHUB_EMAIL_MODE live
```

Start with a small department before the first *All employees* announcement.

## Free plan: what to expect

From Resend's docs as of Oct 2026. **Check https://resend.com/pricing before relying on these.**

- **100 emails/day and 3,000/month.** Each recipient counts as one email.
- API rate limit of a few requests per second per team. ONE HUB sends about 1.6/second.
- Free-plan domain allowance is limited (sources say one). ONE HUB needs one.
- API keys, webhooks and test inboxes are included.

How ONE HUB stays inside these limits:
- It counts every email Resend accepts (per UTC day) and **never** hands Resend more than the daily or
  monthly allowance.
- If an announcement has more recipients than today's allowance, the director has to confirm it. The rest is
  then **sent automatically after the daily reset**. Nothing is dropped and no extra accounts are used.
- If Resend still reports `daily_quota_exceeded` or `monthly_quota_exceeded`, the email waits for the reset
  instead of being marked failed.
- If the company has more than about 100 employees and needs same-day announcements to everyone, the
  supported option is a Resend paid plan (Pro has no daily cap). That needs the owners' approval. Set
  `ONEHUB_EMAIL_DAILY_LIMIT=0` only after upgrading.
