# ONE HUB architecture

## 1. Overview

```
 Browser / installed PWA (React SPA on Cloudflare Pages)
        │  WebSocket (reactive queries + mutations)        HTTPS (auth routes)
        ▼                                                   ▼
 ┌──────────────────────────── Convex deployment (one per environment) ────────────────────────────┐
 │  Queries / mutations  ── every call: requireUser / requirePermission (convex/lib/auth.ts)        │
 │  Shared database (one schema for all three portals)                                              │
 │  File storage (assets, post media, profile photos; private signed URLs)                          │
 │  Crons → internal mutations/actions: publishing engine · reminders · queue recovery              │
 │  Actions → Resend, Meta Graph (and later Google, Microsoft Graph, LinkedIn, Web Push)            │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**One shared database.** The portals are only *views*. Director A's broker insert is pushed over the
WebSocket to every subscribed client within milliseconds, so there is no refresh button and no
per-portal copy. Admin can switch between Admin, Directors and Marketing views with the portal
switcher in the sidebar.

## 2. Collaboration guarantees

| Guarantee | How |
|---|---|
| Real-time sync | Convex reactive queries (`useQuery`, `usePaginatedQuery`) |
| No silent overwrites | Every shared record has `version`; updates pass `expectedVersion` and fail with `CONFLICT` if someone else saved first. Edit sheets show a "just updated" banner live. |
| Who changed what | `createdBy`, `updatedBy`, `updatedAt` on each record + `auditLogs` table + per-record history panels |
| Duplicates | Normalised keys (`emailKey`, SA-normalised `mobileKey`, `nameKey`) checked on create, update and import |
| Soft delete | `archivedAt`. Archive and restore everywhere; hard delete only for POPIA erasure (Super Admin) |
| Imports | Preview → field mapping → server validation (new / existing / duplicate-in-file / invalid) → explicit confirmation. Existing records only updated when ticked, and only if unchanged since preview. |

## 3. Data model (`convex/schema.ts`)

`users` (extends Convex Auth) · `invitations` · `properties` · `brokers` · `employees` · `meetings` ·
`meetingParticipants` · `meetingReminders` · `calendarConnections` · `leadForms` · `leads` ·
`rateLimits` · `marketingAccounts` · `marketingCampaigns` · `socialPosts` · `publishingJobs` ·
`marketingAssets` · `marketingIdeas` · `announcements` · `emailJobs` · `notifications` ·
`notificationPreferences` · `pushSubscriptions` · `auditLogs` · `integrationSettings`

Personal data stays personal: `calendarConnections`, `notificationPreferences`, `pushSubscriptions`
and private meetings are only readable by their owner. OAuth tokens are only read by internal
functions and are never returned to clients.

## 4. Roles & permissions (`convex/lib/permissionMatrix.ts`)

A single matrix (role → permission set) shared by the backend and the UI. The UI uses it only to
hide what you can't use. **Every Convex function re-checks permissions on the server.**
Per-user grants cover the matrix's "Authorized" / "Own if enabled" cells (`marketingSocialAccess`,
`calendarEnabled`). To customise later, edit the matrix or layer overrides in `resolvePermissions`.

| Feature | Super Admin | Director | Marketing |
|---|---|---|---|
| User management | Full | – | – |
| Brokers / Employees | Full | Full | – |
| Announcements | Full | Send | – |
| Lead forms | Full | Full | Create/Edit |
| Leads | Full | Full | Authorized (forms shared with marketing) |
| Company meetings | Full | Manage | Invited |
| Personal calendar | Own | Own | Own if enabled |
| Library / Campaigns / Social | Full | View | Full |
| Social connections | Full | – | If granted |
| Settings, audit | Full | – | – |

## 5. Background jobs (`convex/crons.ts`)

| Job | Interval | Notes |
|---|---|---|
| `socialPosts.enqueueDue` | 1 min | Moves due posts to `publishing`, creates one job per (post, account, version). The idempotency key prevents duplicate publishing. |
| `socialPosts.runJobs` | on demand | Calls the official API; exponential retry for rate limits/5xx; token errors fail fast; rolls status up to `published`/`failed`; alerts author + admins |
| `socialPosts.recoverStuck` | 15 min | Never blindly retries a job that may have posted. It marks it failed for human review. |
| `meetings.sendDueReminders` | 5 min | 24h / 1h / custom reminders → in-app (+ optional email fallback) |
| `emails.processQueue` | on enqueue | Paced batches, dedupe keys, retries with backoff |
| `emails.recoverStuck` | 10 min | Requeues crashed sends |

Everything runs inside Convex, so nobody's browser needs to stay open.

## 6. Sitemap

```
/login  /accept-invite  /reset-password  /f/:slug (public lead form)
/admin  /admin/users  /admin/audit  /admin/integrations  /admin/permissions  /admin/usage  /admin/settings  /admin/email
/directors  /directors/brokers[/import|/:id]  /directors/employees[/import|/announcements|/:id]  /directors/documents  /directors/marketing
/leads[/:id]  /forms[/new|/:id]  /calendar  /properties[/:id]
/marketing  /marketing/social[?tab=]  /marketing/social/new  /marketing/social/posts/:id  /marketing/social/accounts
/marketing/campaigns[/:id]  /marketing/library  /marketing/ideas
/notifications  /settings
```

## 7. Design system

Tokens live in `src/index.css` (`@theme`). The brand orange (`--color-brand-*`, base `#F26B1D`) is a
**temporary token**: the official ONE Property Holdings brand guide and website could not be accessed
from the build environment. Swap the values and the `Logo` component once the assets are confirmed.
Charcoal sidebar (`--color-ink`), warm-grey canvas, white cards, orange used for primary actions and
active state only. Components: `src/components/ui/*` (Button, Input/Select/Field/Switch, Card, Badge,
Dialog/Sheet/ConfirmDialog, Menu, Tabs, StatCard, EmptyState, Skeleton, Avatar).
