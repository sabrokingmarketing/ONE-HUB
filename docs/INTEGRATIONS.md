# Integrations

Status legend: **Built** = code exists and is covered by tests · **Built, unverified** = code exists but
has not yet run against the live provider · **Planned**.
No integration is shown as "Verified" in the app until a real end-to-end call has succeeded.

| Integration | Status | External approval needed |
|---|---|---|
| Convex Auth (email + password, invite-only, reset by email code) | Built | None |
| Resend transactional email + announcement queue | Built, unverified | New API key + verified sending subdomain |
| Google Calendar | Planned | Google Cloud project, OAuth consent screen; `calendar.events` is a *sensitive* scope (for an internal Google Workspace org, mark the app "Internal" to skip verification) |
| Microsoft Outlook Calendar (Graph) | Planned | Microsoft Entra app registration (`Calendars.ReadWrite`, `offline_access`); tenant admin consent |
| Web Push | Partially built (service-worker `push` + `notificationclick` handlers, `pushSubscriptions` table) | VAPID key pair; iOS needs the installed PWA (16.4+) |

## Marketing portal & social media (removed for now)

The Marketing portal was removed at the owners' request: social scheduling and publishing,
Facebook/Instagram/LinkedIn connections, campaigns, the ideas board and the marketing library.
ONE HUB now has two roles (Super Admin, Director) and two portals (Admin, Directors). The marketing
library's upload features moved to **Directors → Documents**.

The full implementation (OAuth connect flows, publishers, scheduling engine and their tests) is preserved
in git history at commit `c52b941` on this branch. It can be restored when needed.

## Safety switches

- **Email mode**: `log` by default (see SETUP §4).
