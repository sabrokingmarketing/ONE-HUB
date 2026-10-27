# Build status

_Last updated: 27 Oct 2026._

## Environment audit (Phase 1)

| Item | Finding |
|---|---|
| Repository | `sabrokingmarketing/one-hub`: empty apart from a README. New isolated project created here. |
| Convex | No deployment linked. The build sandbox cannot reach Convex cloud or download the local backend (network policy), so functions were verified with **convex-test** and an offline codegen script. **Nothing was created or changed in any Convex account.** |
| Cloudflare / Resend / domains | No credentials available in the build environment. **Nothing was created or changed.** A Resend connector exists in the workspace but was deliberately not used: creating keys/domains is an externally visible action that needs your approval. |
| Brand | The ONE Property Holdings website was blocked by the build network, so the brand orange and logo are **temporary tokens** (`src/index.css`, `Logo.tsx`). |

## Done

**Phase 2: Foundation**
- Vite + React 19 + TS + Tailwind v4 app, design system, responsive shell (sidebar, portal switcher, ⌘K global search, notification centre, mobile drawer), error boundary, lazy-loaded routes, code splitting.
- Convex schema for the full platform; invite-only Convex Auth with bootstrap admin, password reset, suspension and session revocation; server-enforced permission matrix; audit logging.

**Phase 3: Business operations**
- Broker directory: CRUD, search, filters, archive/restore, duplicate detection, profile, share (copy, Maps, vCard, native share) without internal notes, CSV/XLSX import wizard, CSV export.
- Employee directory: same, plus profile photos and **Send Employee Update** (templates, recipients by all/department/selection, preview, test send, confirmation, dedupe, delivery tally).
- Property directory with linked brokers, campaigns, forms, assets.
- Lead form builder (13 field types, ordering, live preview, branding, notifications, marketing sharing) + public form with spam protection; share via link, email, WhatsApp, embed code, QR.
- Leads: shared list with status pipeline, search, assignment, notes, marketing visibility, export, POPIA archive/erase.
- Calendar: month/week/day/list, company vs private meetings, participants, RSVP, reminders (24h/1h/custom) via cron, email invites.
- Admin: dashboard (KPIs, lead chart, alerts, activity), users & invitations, audit log, integrations health, permissions matrix, usage & limits, settings, email log.

**Phase 4: Marketing workspace**
- Marketing dashboard, content calendar (drag-to-reschedule), post composer (media upload, caption/hashtags, preview, scheduling, optional approval), post lists by status, duplicate/cancel, publishing log.
- Publishing engine with idempotent jobs, retries, failure alerts, and a **live-publishing kill switch (off by default)**.
- Campaigns (tasks/progress, linked posts), marketing library (upload, categories, tags, folders, versions, share-with-directors), ideas Kanban (drag & drop, convert to campaign/post).

**Phase 6 (partial): PWA**: manifest, icons, service worker (app shell only), update prompt, push/notification-click handlers, iOS install guidance.

**Quality**: `npm run typecheck`, `npm test` (12 backend tests) and `npm run build` all pass. UI reviewed at desktop and mobile widths using the dev-only harness (fictional sample data).

## Remaining

| Phase | Work |
|---|---|
| 5 | OAuth connect flows: Meta (FB/IG), LinkedIn, Google Calendar, Microsoft Graph; Instagram & LinkedIn publishers; calendar two-way sync with dedupe + token refresh; Web Push sending (VAPID) + subscription UI |
| 5 | Resend delivery webhooks (bounces/delivered) → `emailJobs` status |
| 6 | Push permission flow, offline state messaging |
| 7 | End-to-end tests against a real dev deployment (Playwright), accessibility audit, load test of imports |
| 8 | Production deployment (needs approval), custom domain, onboarding session |
| Later | Automated lead retention job, day-spanning email batching, per-user permission overrides UI, R2 media offload (needs approval) |

## Blockers / decisions needed from you

1. **Convex**: run `npx convex dev` locally (or give this environment network access) to create the dedicated `one-hub` project.
2. **Resend**: approve creating a dedicated sending subdomain + API key, and choose the From address.
3. **Cloudflare**: approve creating the `one-hub` Pages project and the `hub.` subdomain.
4. **Brand assets**: official logo files and the exact orange (hex).
5. **Developer apps**: Meta (App Review), LinkedIn (Community Management API), Google Cloud OAuth, Microsoft Entra. These require company verification and take days to weeks, so start early.
6. **Bootstrap admin email** for the first Super Admin.
