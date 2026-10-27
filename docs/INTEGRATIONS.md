# Integrations

Status legend: **Built** = code exists and is covered by tests · **Built, unverified** = code exists but
has not been exercised against the live provider · **Planned** = not implemented yet.
No integration is shown as "Verified" in the app until a real end-to-end call has succeeded.

| Integration | Status | External approval needed |
|---|---|---|
| Convex Auth (email + password, invite-only, reset by email code) | Built | None |
| Resend transactional email + announcement queue | Built, unverified (no API key in build env) | New API key + verified sending subdomain |
| Facebook Page publishing (Graph API `/{page}/feed`, `/{page}/photos`) | Built, unverified | Meta developer app, Business verification, **App Review** for `pages_manage_posts`, `pages_read_engagement`, `pages_show_list` |
| Facebook/Instagram OAuth connect flow | Planned (Phase 5) | Same Meta app; Facebook Login for Business |
| Instagram publishing (content publishing API: container → publish) | Planned (Phase 5) | `instagram_basic`, `instagram_content_publish` (App Review); IG professional account linked to a Page |
| LinkedIn Page publishing (Posts API) | Planned (Phase 5) | LinkedIn developer app + **Community Management API** access request (approval can take weeks) |
| Google Calendar | Planned (Phase 5) | Google Cloud project, OAuth consent screen; `calendar.events` is a *sensitive* scope, so expect Google verification for an external app. For an internal Google Workspace org, mark the app "Internal" to skip verification. |
| Microsoft Outlook Calendar (Graph) | Planned (Phase 5) | Microsoft Entra app registration (`Calendars.ReadWrite`, `offline_access`); tenant admin consent |
| Web Push | Partially built: service-worker `push` + `notificationclick` handlers, `pushSubscriptions` table | VAPID key pair (`npx web-push generate-vapid-keys`); iOS needs the installed PWA (16.4+) |
| Campaign/post insights | Planned | Same platform permissions (`read_insights` etc.). ONE HUB never shows estimated metrics. |

## Safety switches

- **Live publishing** (Admin → Integrations) defaults **off**. When off, due posts fail with a clear
  "nothing was posted" reason, so test schedules can't reach real audiences.
- **Require approval**: optional admin approval step before posts are scheduled.
- **Email mode**: `log` by default (see SETUP §4).

## Token handling

Platform tokens live in `marketingAccounts.accessToken` / `calendarConnections.*Token`, readable only
by internal functions. Queries that list accounts strip tokens. Expired tokens put the account into
`expired`, which blocks scheduling and asks for re-authorisation.
