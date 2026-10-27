# Setup, environments & deployment

> **Isolation rule:** ONE HUB gets its *own* Convex project, its *own* Cloudflare Pages project, its
> *own* Resend API key and sending (sub)domain. Do not reuse or modify any existing project, DNS
> record, database or key.

## 1. Convex (development)

```bash
npm install
npx convex dev
```
Choose **"create a new project"**, name it `one-hub`. This writes `CONVEX_DEPLOYMENT` and
`VITE_CONVEX_URL` to `.env.local` (git-ignored). Then:

```bash
npx @convex-dev/auth                                   # generates JWT_PRIVATE_KEY + JWKS on the deployment
npx convex env set SITE_URL http://localhost:5173
npx convex env set ONEHUB_BOOTSTRAP_ADMIN_EMAIL you@company.co.za
# Email stays in safe "log" mode until you change it (see §4)
```

Run `npm run dev`, open `/accept-invite?bootstrap=1`, register with the bootstrap email. That account
becomes the only Super Admin; the bootstrap path closes as soon as a Super Admin exists.

## 2. Convex (production)

Production is a separate deployment in the same new project:

```bash
npx convex deploy                     # prompts before pushing to prod
npx convex env set --prod SITE_URL https://hub.<your-domain>
npx convex env set --prod ONEHUB_BOOTSTRAP_ADMIN_EMAIL ...
npx @convex-dev/auth --prod
```

## 3. Cloudflare Pages (frontend)

Create a **new** Pages project (e.g. `one-hub`) connected to this repo:

| Setting | Value |
|---|---|
| Build command | `npx convex deploy --cmd 'npm run build'` (needs `CONVEX_DEPLOY_KEY` from the Convex prod deployment) or `npm run build` with `VITE_CONVEX_URL` set |
| Output directory | `dist` |
| Env vars | `CONVEX_DEPLOY_KEY` (secret) **or** `VITE_CONVEX_URL` |

`public/_redirects` provides SPA routing; `public/_headers` sets HSTS, CSP, frame and referrer policies
(lead forms under `/f/*` are embeddable). Add a custom subdomain such as `hub.<domain>`. This adds one
**new** DNS record only; leave all existing records untouched.

## 4. Resend (email)

1. In the existing Resend account, add a **new sending subdomain** (e.g. `mail.hub.<domain>`) and
   verify its DNS records. This doesn't affect existing domains.
2. Create a **new API key** restricted to "Sending access" for that domain.
3. Configure:
```bash
npx convex env set RESEND_API_KEY re_xxx
npx convex env set ONEHUB_EMAIL_FROM "ONE HUB <hub@mail.hub.<domain>>"
npx convex env set ONEHUB_EMAIL_MODE test                  # log | test | live
npx convex env set ONEHUB_EMAIL_TEST_RECIPIENT you@company.co.za
```
`log` (default) sends nothing. `test` redirects every email to the test inbox. Switch to `live`
only after approving real sends.

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
