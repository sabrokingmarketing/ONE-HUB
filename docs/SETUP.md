# Setup, environments & deployment

> **Isolation rule:** ONE HUB gets its *own* Convex project, its *own* Cloudflare Workers project, its
> *own* Resend API key and sending (sub)domain. Do not reuse or modify any existing project, DNS
> record, database or key.

## 1. Convex (development)

Shortcut: `npm install && npm run setup:convex` runs every step below and creates the first Super Admin
invitation for `kelvin@sabroking.co.za` (override with `ADMIN_EMAIL=… ADMIN_NAME=…`). For production:
`npm run setup:convex -- --prod --site-url https://hub.<your-domain>`.

```bash
npm install
npx convex dev
```
Choose **"create a new project"**, name it `one-hub`. This writes `CONVEX_DEPLOYMENT` and
`VITE_CONVEX_URL` to `.env.local` (git-ignored). Then:

```bash
npx @convex-dev/auth                                   # generates JWT_PRIVATE_KEY + JWKS on the deployment
npx convex env set SITE_URL http://localhost:5173
# Email stays in safe "log" mode until you change it (see §4)
npx convex run system:bootstrapAdmin '{"email":"you@company.co.za","name":"Your Name"}'
```

The last command prints a one-time activation link (valid 24 hours) for the first Super Admin. Open it,
set a password, and invite everyone else from Admin → Users & roles. There is no open signup: the command
is internal-only (it needs the deployment's credentials) and refuses once an active Super Admin exists.

## 2. Convex (production)

Production is a separate deployment in the same new project:

```bash
npx convex deploy                     # prompts before pushing to prod
npx convex env set --prod SITE_URL https://hub.<your-domain>
npx @convex-dev/auth --prod
npx convex run --prod system:bootstrapAdmin '{"email":"you@company.co.za","name":"Your Name"}'
```

`SITE_URL` must be set on every deployment before the bootstrap command or any email: the backend refuses
to build links without it rather than fall back to a wrong host.

## 3. Cloudflare Workers (frontend)

The `one-hub` project is a **Worker with static assets** (Workers Builds), connected to this repo.
`wrangler.toml` serves `dist` as assets with single-page-app fallback; there is no Worker script.

| Setting | Value |
|---|---|
| Build command | `npx convex deploy --cmd 'npm run build'` (needs `CONVEX_DEPLOY_KEY` from the Convex prod deployment) or `npm run build` with `VITE_CONVEX_URL` set |
| Deploy command | `npx wrangler deploy` (Workers Builds default) |
| Node version | 22 (pinned in `.node-version`) |
| Build env vars | `CONVEX_DEPLOY_KEY` (secret) **or** `VITE_CONVEX_URL` |

Unknown paths fall back to `index.html` (`not_found_handling` in `wrangler.toml`); `public/_headers` sets
HSTS, CSP, frame and referrer policies (lead forms under `/f/*` are embeddable). Add a custom subdomain such
as `hub.<domain>`. This adds one **new** DNS record only; leave all existing records untouched.

## 4. Resend (email)

ONE HUB uses a **dedicated Resend account**, separate from every other business or website. Follow
[`RESEND_SETUP.md`](RESEND_SETUP.md) step by step: account, sending domain and DNS, API key, delivery
webhook, environment variables and the controlled test plan. In short:

```bash
npx convex env set RESEND_API_KEY 're_…'            # ONE HUB's own key, "Sending access"
npx convex env set RESEND_WEBHOOK_SECRET 'whsec_…'  # webhook → https://<deployment>.convex.site/resend/webhook
npx convex env set ONEHUB_EMAIL_FROM '"ONE Property Holdings | Internal Communications" <notifications@mailoneholdings.co.za>'
npx convex env set ONEHUB_EMAIL_MODE test                  # log | test | live
npx convex env set ONEHUB_EMAIL_TEST_RECIPIENT approved-test-address
```
`log` (default) sends nothing. `test` redirects every email to the test inbox. Switch to `live`
only after the owners approve real sends.

## 5. Onboarding users

Admin → **Users & roles** → *Invite user*. Choose **Director**, **Super Admin** or **Marketing team**
(Marketing Studio access only, so the marketing team can upload material for directors). The invitee receives a 7-day, single-use link bound to
their email address and sets their own password (min. 10 characters, letters and numbers).
Suspending a user revokes all their sessions immediately.

## 6. Maintenance

- `npm test` and `npm run typecheck` before every deploy.
- Review **Admin → Integrations** and **Usage & limits** monthly, and the Convex dashboard usage page.
- Schema changes: add optional fields first, backfill with an internal mutation, then tighten.
- `convex/_generated` is committed. Regenerate with `npx convex dev` (or `npm run codegen:offline`).
