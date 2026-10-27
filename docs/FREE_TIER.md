# Free-tier plan

Figures gathered on 27 Oct 2026 from provider pages and secondary sources. **Verify on each provider's
live pricing page before relying on them**: they change, and several were only available via
third-party summaries.

| Provider | Free allowance (as researched) | ONE HUB usage design |
|---|---|---|
| Convex (Starter/free) | ~1M function calls/mo, ~0.5 GB database, ~1 GB file storage, ~1 GB DB bandwidth (unconfirmed), action compute allowance | Indexed queries and pagination everywhere; crons do one indexed lookup when idle; dashboards use bounded scans (fine below ~10k rows per table). The 1-minute publishing cron is about 43k calls/month. |
| Resend (free) | 3,000 emails/mo, **100/day** | Queue paces sends (~1.6/s); dedupe keys; email fallback is opt-in. **Known limitation:** an announcement to more than ~100 employees in one day exceeds the cap. The queue retries for a few minutes, then marks the rest `failed`, visible in the announcement's delivery tally and the email log. Day-spanning scheduling is planned; until then, split large audiences by department or use Resend Pro. |
| Cloudflare Pages | Static requests unlimited; ~500 builds/mo; Workers/Functions ~100k req/day | ONE HUB is a static SPA (no Pages Functions), so request limits don't apply. |
| Google / Microsoft calendar APIs (planned) | Free, rate-limited | Sync on demand; no tight polling. |

## Media storage

Convex file storage (~1 GB free) is used now for shared documents. If the document library grows
past ~700 MB, move large videos to **Cloudflare R2** (10 GB free storage, zero egress). This is a
paid-capable product, so **R2 will not be enabled without approval**.

## Possible future costs

- Convex Professional (about $25/developer/month) if function calls or storage exceed the free tier.
- Resend Pro (about $20/month for 50k emails) for large or frequent announcements.
- Cloudflare R2 beyond 10 GB.
