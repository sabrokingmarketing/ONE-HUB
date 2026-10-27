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
 │  Crons → internal mutations/actions: meeting reminders · email queue recovery                    │
 │  Actions → Resend (and later Google Calendar, Microsoft Graph, Web Push)                         │
 └──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**One shared database.** The portals are only *views*. Director A's broker insert is pushed over the
WebSocket to every subscribed client within milliseconds, so there is no refresh button and no
per-portal copy. A Super Admin can switch between the Admin and Directors views with the portal
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
`rateLimits` · `studioAssets` · `documents` · `announcements` · `emailJobs` · `notifications` ·
`notificationPreferences` · `pushSubscriptions` · `auditLogs` · `integrationSettings`

Personal data stays personal: `calendarConnections`, `notificationPreferences`, `pushSubscriptions`
and private meetings are only readable by their owner. OAuth tokens are only read by internal
functions and are never returned to clients.

## 4. Roles & permissions (`convex/lib/permissionMatrix.ts`)

A single matrix (role → permission set) shared by the backend and the UI. The UI uses it only to
hide what you can't use. **Every Convex function re-checks permissions on the server.**

| Feature | Super Admin | Director | Marketing team |
|---|---|---|---|
| User management, settings, audit, integrations | Full | – | – |
| Brokers / Employees / Properties | Full | Full | – |
| Employee announcements | Full | Send | – |
| Lead forms & leads | Full | Full (permanent erasure: Super Admin only) | – |
| Meetings & calendar | Full | Manage company meetings; own private events | – |
| Documents | Full | Full | – |
| Marketing Studio | Full | View & download | Upload & manage |

The **Marketing team** role exists only so the marketing team can publish material to the Marketing
Studio with their own logins. It lives inside the Directors portal and sees nothing else.

## 5. Background jobs (`convex/crons.ts`)

| Job | Interval | Notes |
|---|---|---|
| `meetings.sendDueReminders` | 5 min | 24h / 1h / custom reminders → in-app (+ optional email fallback) |
| `emails.processQueue` | on enqueue | Paced batches, dedupe keys, retries with backoff |
| `emails.recoverStuck` | 10 min | Requeues crashed sends |

Everything runs inside Convex, so nobody's browser needs to stay open.

## 6. Sitemap

```
/login  /accept-invite  /reset-password  /f/:slug (public lead form)
/admin  /admin/users  /admin/audit  /admin/integrations  /admin/permissions  /admin/usage  /admin/settings  /admin/email
/directors  /directors/brokers[/import|/:id]  /directors/employees[/import|/announcements|/:id]  /directors/documents  /directors/studio[?asset=]
/leads[/:id]  /forms[/new|/:id]  /calendar  /properties[/:id]
/notifications  /settings
```

## 7. Design system

Tokens live in `src/index.css` (`@theme`). The brand orange `#F7931E` (`--color-brand-500`) was sampled from the
official ONE logo, which is used in the sidebar, sign-in page, favicons, PWA icons and emails.
Light floating sidebar with icon tiles (active item: white card + orange tile), cool-grey canvas,
borderless white cards with soft shadows, orange and charcoal KPI tiles. Dashboard rows use fixed,
equal-size blocks with internal scrolling so no block outgrows its neighbours. Components: `src/components/ui/*` (Button, Input/Select/Field/Switch, Card, Badge,
Dialog/Sheet/ConfirmDialog, Menu, Tabs, StatCard, EmptyState, Skeleton, Avatar).
