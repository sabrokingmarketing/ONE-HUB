# Build status

_Last updated: 27 Oct 2026._

ONE HUB currently has **two portals: Admin and Directors**. The earlier Marketing portal (social posting,
campaigns) was removed on request; its code remains in git history (commit `c52b941`). Marketing material
is now shared through the **Marketing Studio** inside the Directors portal.

## Environment audit (Phase 1)

| Item | Finding |
|---|---|
| Repository | `sabrokingmarketing/one-hub`: empty apart from a README. New isolated project created here. |
| Convex | No deployment linked. The build sandbox cannot reach Convex cloud, so functions were verified with **convex-test** and an offline codegen script. **Nothing was created or changed in any Convex account.** |
| Cloudflare / Resend / domains | No credentials in the build environment. **Nothing was created or changed.** |
| Brand | Official ONE logo supplied and in use (`src/assets/logo-one.webp`, favicons, app icons, emails). Brand orange `#F7931E` sampled from the logo. |

## Done

**Foundation**
- Vite + React 19 + TypeScript + Tailwind v4 app with a soft, modern design system.
- Light floating sidebar with icon tiles, breadcrumb top bar, ⌘K global search, notification centre, mobile drawer.
- Every dashboard row uses equal, fixed-size blocks, so no block is bigger than its neighbours.
- Invite-only Convex Auth (bootstrap admin, password reset, suspension with session revocation); server-enforced Super Admin / Director permissions; audit logging.

**Directors portal**
- Dashboard: quick actions, KPI tiles, new-leads table, meetings timeline, recent brokers, employee updates, announcements and documents.
- Broker directory: CRUD, search, filters, archive/restore, duplicate detection, share without internal notes (copy, Maps, vCard, native share), CSV/XLSX import wizard, CSV export.
- Employee directory: the same features plus profile photos, and **Send Employee Update** (templates, recipients, preview, test send, confirmation, dedupe, per-recipient delivery results confirmed by Resend webhooks, automatic pacing within the free plan's daily limit).
- **Marketing Studio**: the marketing team's library of booklets, brochures, designs, social media, presentations, videos, photography, brand files, templates and documents. It has category tiles, featured material, search/filters/sort, grid and list views, in-browser preview (images, video, PDF), one-click download with download counts, collections, cover images, versioning, archive, and optional notifications to directors. Uploaded by the new **Marketing team** role (studio-only access); directors view and download.
- Leads, lead form builder (public forms with spam protection; share by link, email, WhatsApp, embed, QR), calendar & meetings with reminders, properties, shared documents (upload, versions, categories, tags).

**Admin portal**
- Dashboard (KPIs, lead chart, activity), users & invitations, audit log, integrations health, permissions matrix, usage & limits, settings, email log. A Super Admin can switch to the Directors view.

**PWA**: manifest, icons, service worker (app shell only), update prompt, push handlers.

**Quality**: `npm run typecheck`, `npm test` (25 backend tests) and `npm run build` all pass. UI reviewed at desktop and mobile widths with the dev-only harness.

## Remaining

| Work |
|---|
| Google Calendar & Outlook sync (OAuth), Web Push sending + permission UI |
| End-to-end tests against a real dev deployment, accessibility audit |
| Production deployment (needs approval), custom domain, onboarding |
| Automated lead retention job |

## Blockers / decisions needed

1. **Convex**: run `npx convex dev` to create the dedicated `one-hub` project.
2. **Resend**: create the dedicated ONE HUB Resend account and verify the dedicated sending domain `mailoneholdings.co.za`. See [RESEND_SETUP.md](RESEND_SETUP.md).
3. **Cloudflare**: approve the `one-hub` Pages project and `hub.` subdomain.
4. **Brand check**: confirm `#F7931E` (sampled from the logo) is the official orange.
5. **Bootstrap admin email** for the first Super Admin.
