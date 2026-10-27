# Integrations

Status legend: **Built** = code exists and is covered by tests · **Built, unverified** = code exists and is
tested with mocked provider responses, but has not yet run against the live provider · **Planned**.
No integration is shown as "Verified" in the app until a real end-to-end call has succeeded.

| Integration | Status | External approval needed |
|---|---|---|
| Convex Auth (email + password, invite-only, reset by email code) | Built | None |
| Resend transactional email + announcement queue | Built, unverified | New API key + verified sending subdomain |
| **Meta connect** (Facebook Login → Pages + linked Instagram accounts) | Built, unverified | Meta app (below) |
| **Facebook publishing** (text, photo, multi-photo, video) | Built, unverified | `pages_manage_posts` etc. |
| **Instagram publishing** (JPEG image, Reel, carousel) | Built, unverified | `instagram_content_publish` |
| **LinkedIn connect + publishing** (organisation Pages; text + images) | Built, unverified | LinkedIn app with Community Management API |
| LinkedIn video, post insights | Planned | Same apps |
| Google Calendar / Outlook Calendar | Planned (Phase 5) | Google Cloud OAuth app / Microsoft Entra app |
| Web Push | Partially built (service-worker handlers) | VAPID keys |

---

## Connecting social media — what you need to do

ONE HUB uses only the platforms' official APIs. Each platform needs ONE HUB registered as an app
under **your company's** developer account. This can't be done on your behalf: it needs your
business verification and your acceptance of each platform's terms.

You'll need your Convex **site URL** (e.g. `https://<deployment>.convex.site`, shown in the Convex
dashboard → Settings → URL & Deploy Key; Admins also see the exact redirect URLs on
*Marketing → Connected accounts*).

### A. Meta (Facebook Pages + Instagram)

1. Go to <https://developers.facebook.com/apps> → **Create app** → use case **"Manage everything on your Page"** (Business type), owned by the ONE Property Holdings **Business Portfolio**.
2. Add the **Facebook Login for Business** product. In its settings, add the Valid OAuth Redirect URI:
   `https://<deployment>.convex.site/oauth/meta/callback`
3. Add the **Instagram** product (Instagram API with Facebook Login).
4. Request these permissions: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`.
5. While the app is in **Development mode**, it already works for people who have a role on the app (add your admins/marketing team as app Testers/Developers) and who admin the Pages. That is enough for ONE HUB's internal use **and lets you start posting right away**.
6. For anyone without an app role, complete **Business Verification** and **App Review** for the permissions above (provide the screencast of the ONE HUB connect + scheduling flow), then switch the app to **Live**.
7. Each Instagram account must be a **professional (Business/Creator) account linked to a Facebook Page**.
8. Set the keys on the Convex deployment:
   ```bash
   npx convex env set META_APP_ID <App ID>
   npx convex env set META_APP_SECRET <App Secret>
   ```

### B. LinkedIn (company Pages)

1. Go to <https://www.linkedin.com/developers/apps> → **Create app**, associate it with the ONE Property Holdings LinkedIn Page and have a Page admin **verify** the association.
2. **Products** tab → request **Community Management API** (LinkedIn reviews this; it can take days to weeks).
3. **Auth** tab → add Authorized redirect URL: `https://<deployment>.convex.site/oauth/linkedin/callback`
4. Set the keys:
   ```bash
   npx convex env set LINKEDIN_CLIENT_ID <Client ID>
   npx convex env set LINKEDIN_CLIENT_SECRET <Client Secret>
   ```
5. The person connecting must be a **Super admin or Content admin** of the LinkedIn Page.

### C. Connect and go live

1. In ONE HUB: **Marketing → Connected accounts → Connect** (Super Admin, or a marketing user granted
   "Manage social connections"). Approve the platform's consent screen and select the Pages.
2. **First post = supervised test.** Schedule one post a few minutes ahead to a single account.
3. **Admin → Integrations → Live publishing: ON.** Until this is on, due posts fail safely with
   "nothing was posted". This is the deliberate final switch.
4. Check the post on the platform and the publishing log in ONE HUB (it records the platform's post ID).

Optional: `META_GRAPH_VERSION` (default `v24.0`) and `LINKEDIN_API_VERSION` (default `202509`) let you
move to newer API versions without a code change. Check both against the platforms' current version
policies when you set up the apps.

## Platform rules enforced before scheduling

| Platform | Rule |
|---|---|
| Facebook | Text, 1–10 photos, or exactly one video |
| Instagram | Needs media; **JPEG only** (no PNG); 1 image, 1 video (Reel) or 2–10 item carousel |
| LinkedIn | Text and up to 9 images; video not yet supported |

## Safety switches

- **Live publishing** (Admin → Integrations) defaults **off**.
- **Require approval**: optional admin approval step before posts are scheduled.
- **Email mode**: `log` by default (see SETUP §4).

## Token handling

- Tokens are stored server-side only; list queries strip them and the OAuth callback never puts them in a URL.
- Meta Page tokens are derived from a long-lived user token (they don't expire unless the user changes password or revokes access).
- LinkedIn tokens last ~60 days. A daily job refreshes them when LinkedIn issues a refresh token, otherwise it marks the account *Expired* and notifies the person who connected it plus admins.
- A token rejected while publishing (e.g. Meta error 190) immediately marks the account *Expired* and alerts the same people.
